// I'M NEW HERE (menu/new-here.js, mounted by menu/lobby-fn.js): the Play
// page's tutorial. Offline: Supabase is blocked; nothing starts a match.
//   1. The button is on the Play page, named, inside the screen and the
//      phone's safe areas, over nothing else of the lobby.
//   2. Every page opens (and each of the controls' three inputs), at 1366
//      and 1920 wide (--ui-z 1.25), an upright and a sideways phone with an
//      iPhone's insets: the sheet is inside the safe areas, no line of text
//      overlaps another or is cut by its box (measured per line of text),
//      nothing scrolls sideways, the pictures load, every touch button has
//      its icon.
//   3. Mouse: the tabs, Next / Back, Let's go, the X and the backdrop.
//   4. Keyboard: Enter opens, arrows turn pages, Tab stays inside, H and
//      Enter don't reach the lobby behind, Esc closes and focus comes back.
//   5. Touch: a tap opens on Touch, a swipe turns the page, the X closes.
//   6. Pad: Y opens on Controller, RB / LB / the d-pad turn pages, down
//      scrolls, X changes the input, B closes.
// Screenshots: .claude/run/nh-*.png
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-new-here-test.mjs
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = path.join(ROOT, ".claude/run");
fs.mkdirSync(SHOTS, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg", ".mp4": "video/mp4", ".webm": "video/webm" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const browser = await chromium.launch({ args: [`--use-angle=${process.env.ANGLE || "d3d11"}`, "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const errors = [];
let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `nh-${name}.png`) });

async function open(name, opts, { insets, pad } = {}) {
  const ctx = await browser.newContext(opts);
  await ctx.route(/supabase/, (r) => r.abort());
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
  if (insets) await (await ctx.newCDPSession(page)).send("Emulation.setSafeAreaInsetsOverride", { insets });
  if (pad) await page.addInitScript(() => {
    const pad = { id: "Xbox Wireless Controller (STANDARD GAMEPAD)", index: 0, connected: true, mapping: "standard", axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })), timestamp: 1 };
    window.__pad = pad;
    Object.defineProperty(navigator, "getGamepads", { configurable: true, value: () => { pad.timestamp++; return [pad]; } });
  });
  await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1&season=off`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__toBo2?.fn?.help && !!document.querySelector(".to-fn-newhere"), null, { timeout: 180000 });
  await page.waitForTimeout(2000);
  return { ctx, page };
}

/* The lobby's button: on screen, in the safe areas, over nothing. */
const lobbyCheck = (page) => page.evaluate(() => {
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;inset:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);pointer-events:none";
  document.body.append(probe);
  const safe = probe.getBoundingClientRect();
  probe.remove();
  const b = document.querySelector(".to-fn-newhere");
  const r = b.getBoundingClientRect();
  const shown = (e) => e.offsetParent && getComputedStyle(e).visibility !== "hidden" && e.getBoundingClientRect().width > 0;
  const hit = (a, o) => a.left < o.right - 1 && a.right > o.left + 1 && a.top < o.bottom - 1 && a.bottom > o.top + 1;
  const others = [".to-fn-season", ".to-fn-pair", ".to-fn-quests", ".to-fn-news", ".to-fn-top", ".to-fn-play", ".to-bo2-party", ".to-fn-allmodes", ".to-stage-tag", ".to-stage-add", ".to-stage-bubble", ".to-bo2-foot", ".to-radio-toggle"]
    .flatMap((s) => [...document.querySelectorAll(s)]).filter((e) => shown(e) && !e.contains(b));
  const under = others.filter((o) => hit(r, o.getBoundingClientRect())).map((o) => o.className);
  const label = b.querySelector("span");
  return {
    shown: !!shown(b), under, inSafe: r.left >= safe.left - 0.5 && r.right <= safe.right + 0.5 && r.top >= safe.top - 0.5 && r.bottom <= safe.bottom + 0.5,
    textFits: label.scrollWidth <= label.clientWidth + 1 && label.getBoundingClientRect().right <= r.right + 0.5,
    name: b.textContent.trim(), popup: b.getAttribute("aria-haspopup"), zoom: getComputedStyle(document.querySelector(".to-cab, #to-cab, body")).getPropertyValue("--ui-z") || getComputedStyle(document.documentElement).getPropertyValue("--ui-z"),
  };
});

/* The open sheet: inside the safe areas; per line of text, nothing over
   anything else, nothing cut by its button or the card, no sideways
   scroll; the pictures loaded. */
const sheetCheck = (page) => page.evaluate(async () => {
  const sheet = document.querySelector(".to-nh"), card = sheet.querySelector(".to-nh-card"), body = sheet.querySelector(".to-nh-body");
  for (const img of sheet.querySelectorAll(".to-nh-page:not([hidden]) .to-nh-in:not([hidden]) img, .to-nh-page:not([hidden]) > .to-nh-pic img")) {
    img.loading = "eager";
    if (!img.complete) await new Promise((r) => { img.onload = img.onerror = r; setTimeout(r, 8000); });
  }
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;inset:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);pointer-events:none";
  document.body.append(probe);
  const safe = probe.getBoundingClientRect();
  probe.remove();
  const c = card.getBoundingClientRect(), bb = body.getBoundingClientRect();
  const lines = [];
  const walk = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
  for (let n; (n = walk.nextNode());) {
    if (!n.textContent.trim()) continue;
    const el = n.parentElement;
    if (!el.offsetParent || getComputedStyle(el).visibility === "hidden" || el.closest("[hidden]")) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    for (let r of range.getClientRects()) {
      // (scrolled out of the page: hidden by its clip, measure what shows)
      if (body.contains(el)) { const top = Math.max(r.top, bb.top), bot = Math.min(r.bottom, bb.bottom); if (bot - top < 0.5) continue; r = { left: r.left, right: r.right, top, bottom: bot, width: r.width, height: bot - top }; }
      if (r.width > 0.5 && r.height > 0.5) lines.push({ n, el, r, t: n.textContent.trim().slice(0, 24) });
    }
  }
  const problems = [];
  for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
    const a = lines[i].r, b = lines[j].r;
    if (lines[i].n === lines[j].n) continue;
    if (a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1) problems.push(`overlap "${lines[i].t}" / "${lines[j].t}"`);
  }
  for (const { el, r, t } of lines) {
    const box = el.closest("button, kbd, .to-nh-ticon");
    if (box) { const k = box.getBoundingClientRect(); if (r.left < k.left - 1 || r.right > k.right + 1 || r.top < k.top - 1 || r.bottom > k.bottom + 1) problems.push(`cut by its box "${t}"`); }
    if (r.left < c.left - 0.5 || r.right > c.right + 0.5) problems.push(`out of the card sideways "${t}"`);
    if (!body.contains(el) && (r.top < c.top - 0.5 || r.bottom > c.bottom + 0.5)) problems.push(`out of the card "${t}"`);
    if (body.contains(el) && (r.left < bb.left - 0.5 || r.right > bb.right + 0.5)) problems.push(`out of the page sideways "${t}"`);
  }
  const imgs = [...sheet.querySelectorAll(".to-nh-page:not([hidden]) img")].filter((i) => i.offsetParent);
  return {
    problems: [...new Set(problems)].slice(0, 8), lines: lines.length,
    inSafe: c.left >= safe.left - 0.5 && c.right <= safe.right + 0.5 && c.top >= safe.top - 0.5 && c.bottom <= safe.bottom + 0.5,
    sideScroll: body.scrollWidth > body.clientWidth + 1,
    imgs: imgs.map((i) => i.naturalWidth > 0),
    icons: [...sheet.querySelectorAll(".to-nh-touch .to-nh-ticon")].filter((i) => i.offsetParent).map((i) => i.classList.contains("is-move") || i.classList.contains("is-look") || !!i.querySelector("svg") || !!i.textContent.trim()),
    page: window.__toBo2.fn.help.page(), input: window.__toBo2.fn.help.input(),
  };
});

const sizes = [
  { name: "d1366", opts: { viewport: { width: 1366, height: 768 } } },
  { name: "d1920", opts: { viewport: { width: 1920, height: 1080 } } },
  { name: "phone-port", opts: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } },
  { name: "phone-land", opts: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, insets: { top: 0, left: 47, right: 47, bottom: 21 } },
];

// 1 + 2: every size, every page
for (const s of sizes) {
  const { ctx, page } = await open(s.name, s.opts, { insets: s.insets });
  const L = await lobbyCheck(page);
  check(L.shown && L.inSafe && !L.under.length && L.textFits, `${s.name}: I'm new here on the Play page, in the safe area, over nothing, its words whole`, JSON.stringify(L));
  check(/I'm new here/i.test(L.name) && L.popup === "dialog", `${s.name}: named, opens a dialog`);
  await shot(page, `${s.name}-lobby`);
  await page.evaluate(() => window.__toBo2.fn.help.open());
  await page.waitForTimeout(400);
  const pages = await page.evaluate(() => window.__toBo2.fn.help.pages);
  for (let i = 0; i < pages.length; i++) {
    await page.evaluate((i) => window.__toBo2.fn.help.show(i), i);
    const inputs = pages[i] === "controls" ? ["kbm", "pad", "touch"] : [null];
    for (const inp of inputs) {
      if (inp) await page.evaluate((v) => window.__toBo2.fn.help.setInput(v), inp);
      await page.waitForTimeout(250);
      const r = await sheetCheck(page);
      const what = `${s.name}: ${pages[i]}${inp ? ` (${inp})` : ""}`;
      check(r.page === pages[i] && r.lines > 10, `${what} opens`, `${r.lines} lines`);
      check(r.inSafe && !r.sideScroll, `${what}: the sheet inside the safe area, no sideways scroll`);
      check(!r.problems.length, `${what}: no text overlaps or is cut`, r.problems.join(" | "));
      if (r.imgs.length) check(r.imgs.every(Boolean), `${what}: its picture loads`, JSON.stringify(r.imgs));
      if (inp === "touch") check(r.icons.length === 14 && r.icons.every(Boolean), `${what}: every touch button has its icon`, JSON.stringify(r.icons));
      await shot(page, `${s.name}-${pages[i]}${inp ? `-${inp}` : ""}`);
    }
  }
  await page.evaluate(() => window.__toBo2.fn.help.close());
  await page.waitForTimeout(200);
  check(await page.evaluate(() => document.querySelector(".to-nh").hidden), `${s.name}: closes again`);
  if (s.name === "d1920") check(+L.zoom > 1.2, "1920: the UI is zoomed (--ui-z) and still fits", L.zoom);
  await ctx.close();
}

const st = (page) => page.evaluate(() => ({
  open: !document.querySelector(".to-nh").hidden, page: window.__toBo2.fn.help.page(), input: window.__toBo2.fn.help.input(),
  focusIn: !!document.activeElement?.closest(".to-nh"), focus: document.activeElement?.className || "",
  screen: window.__toBo2.menu.current(), game: window.__trollOps.state(), modes: !document.querySelector(".to-fn-modes").hidden,
  wheel: !!document.querySelector(".to-emote-wheel:not([hidden])"), next: document.querySelector(".to-nh-step.is-next").textContent,
  modal: document.querySelector(".to-nh").getAttribute("aria-modal"), selected: document.querySelector(".to-nh-tab[aria-selected=true]")?.textContent,
}));

// 3 + 4: mouse and keyboard
{
  const { ctx, page } = await open("mouse", { viewport: { width: 1366, height: 768 } });
  await page.click(".to-fn-newhere");
  await page.waitForTimeout(300);
  let s = await st(page);
  check(s.open && s.page === "modes" && s.modal === "true" && s.focusIn && s.input === "kbm", "mouse: the button opens it on Modes, focus inside, keyboard first", JSON.stringify(s));
  await page.mouse.move(683, 400);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(300);
  check(!(await st(page)).modes, "a scroll over it doesn't open All modes behind");
  for (const id of ["controls", "locker", "more", "modes"]) {
    await page.click(`#to-nh-tab-${id}`);
    s = await st(page);
    check(s.page === id, `the ${id} tab shows its page`, s.selected);
  }
  for (let i = 0; i < 3; i++) await page.click(".to-nh-step.is-next");
  s = await st(page);
  check(s.page === "more" && s.next === "Let's go", "Next walks to the last page, which says Let's go", JSON.stringify(s));
  await page.click('.to-nh-step[data-step="-1"]');
  check((await st(page)).page === "locker", "Back goes back");
  await page.click(".to-nh-step.is-next");
  await page.click(".to-nh-step.is-next");
  check(!(await st(page)).open, "Let's go closes it");
  await page.click(".to-fn-newhere");
  await page.click(".to-nh-x");
  check(!(await st(page)).open, "the X closes it");
  await page.click(".to-fn-newhere");
  await page.mouse.click(6, 6);
  check(!(await st(page)).open, "a click on the backdrop closes it");

  // keyboard
  await page.focus(".to-fn-newhere");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(250);
  s = await st(page);
  check(s.open && /to-nh-tab/.test(s.focus), "Enter opens it, the first tab focused", s.focus);
  await page.keyboard.press("ArrowRight");
  check((await st(page)).page === "controls", "ArrowRight: the next page");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  check((await st(page)).page === "more", "ArrowLeft from the first wraps to the last");
  let inside = true;
  for (let i = 0; i < 30; i++) { await page.keyboard.press("Tab"); inside &&= (await st(page)).focusIn; }
  for (let i = 0; i < 10; i++) { await page.keyboard.press("Shift+Tab"); inside &&= (await st(page)).focusIn; }
  check(inside, "Tab and Shift+Tab stay inside the sheet");
  await page.keyboard.press("h");
  await page.focus("#to-nh-tab-modes");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  s = await st(page);
  check(!s.wheel && s.screen === "main" && s.game === "menu" && s.open && s.page === "modes", "H and Enter don't reach the lobby behind (no emote wheel, no Public Match)", JSON.stringify(s));
  await page.click("#to-nh-tab-controls");
  await page.focus("#to-nh-in-kbm");
  await page.keyboard.press("ArrowRight");
  check((await st(page)).input === "pad" && (await st(page)).page === "controls", "ArrowRight on the input row changes the input, not the page");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  s = await st(page);
  check(!s.open && /to-fn-newhere/.test(s.focus) && s.screen === "main", "Esc closes it, focus back on the button", s.focus);
  await page.evaluate(() => window.__toBo2.fn.help.open());
  await page.evaluate(() => window.__toBo2.fn.goTab("locker"));
  await page.waitForTimeout(400);
  check(!(await st(page)).open, "leaving the Play page closes it");
  await ctx.close();
}

// 5: touch
{
  const { ctx, page } = await open("touch", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, { insets: { top: 47, left: 0, right: 0, bottom: 34 } });
  await page.tap(".to-fn-newhere");
  await page.waitForTimeout(300);
  let s = await st(page);
  check(s.open && s.input === "touch", "touch: a tap opens it, the controls on Touch", JSON.stringify(s));
  const swipe = async (dx) => { await page.mouse.move(195 - dx / 2, 500); await page.mouse.down(); await page.mouse.move(195 + dx / 2, 505, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(200); };
  await swipe(-200);
  check((await st(page)).page === "controls", "a swipe left: the next page");
  await swipe(200);
  check((await st(page)).page === "modes", "a swipe right: back");
  await page.tap(".to-nh-x");
  check(!(await st(page)).open, "the X closes it");
  await ctx.close();
}

// 6: pad
{
  const { ctx, page } = await open("pad", { viewport: { width: 1366, height: 768 } }, { pad: true });
  const B = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
  // held for two whole frames, and let go for two: the lobby polls the pad
  // once a frame, and a frame under the sheet's blur can outlast a 200 ms tap
  const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const press = async (n) => {
    await page.evaluate(async ([i, f]) => { const b = window.__pad.buttons[i]; b.pressed = true; b.value = 1; await eval(f)(); }, [B[n], frames.toString()]);
    await page.waitForTimeout(60);
    await page.evaluate(async ([i, f]) => { const b = window.__pad.buttons[i]; b.pressed = false; b.value = 0; await eval(f)(); }, [B[n], frames.toString()]);
    await page.waitForTimeout(60);
  };
  await page.waitForFunction(() => document.querySelector(".to-bo2").classList.contains("has-pad"), null, { timeout: 10000 });
  check(await page.evaluate(() => !!document.querySelector(".to-fn-newhere .to-fn-padkey")?.offsetParent), "pad: Y shows on the button");
  await shot(page, "pad-0-lobby");
  await press("Y");
  let s = await st(page);
  check(s.open && s.page === "modes" && s.input === "pad", "Y opens it, the controls on Controller", JSON.stringify(s));
  await shot(page, "pad-1-open");
  await press("DOWN");
  await page.waitForTimeout(500);
  check(await page.evaluate(() => document.querySelector(".to-nh-body").scrollTop > 0), "d-pad down scrolls the page");
  await press("RB");
  s = await st(page);
  check(s.page === "controls" && s.input === "pad", "RB: Controls, on Controller", JSON.stringify(s));
  await shot(page, "pad-2-controls");
  await press("X");
  check((await st(page)).input === "touch", "X: Touch");
  await press("X");
  check((await st(page)).input === "kbm", "X again: Keyboard & mouse");
  // (let go the moment the page turns: held past 380 ms the lobby repeats it,
  // and a slow headless frame can get there)
  await page.evaluate(() => { const b = window.__pad.buttons[15]; b.pressed = true; b.value = 1; });
  await page.waitForFunction(() => window.__toBo2.fn.help.page() !== "controls", null, { timeout: 3000 }).catch(() => {});
  await page.evaluate(() => { const b = window.__pad.buttons[15]; b.pressed = false; b.value = 0; });
  await page.waitForTimeout(200);
  s = await st(page);
  check(s.page === "locker", "d-pad right: the next page", JSON.stringify(s));
  await shot(page, "pad-3-locker");
  await press("RB");
  s = await st(page);
  check(s.page === "more", "RB: The rest", JSON.stringify(s));
  await press("RB");
  check((await st(page)).page === "modes", "RB from the last wraps round");
  await press("LB");
  check((await st(page)).page === "more", "LB goes back");
  await shot(page, "pad-4-more");
  await press("A");
  s = await st(page);
  check(s.open && s.screen === "main" && s.game === "menu", "A presses the focused tab, nothing behind (no PLAY)", JSON.stringify(s));
  await press("B");
  s = await st(page);
  check(!s.open && s.screen === "main" && s.game === "menu", "B closes it, still on Play", JSON.stringify(s));
  await shot(page, "pad-5-closed");
  await ctx.close();
}

check(!errors.length, "no page errors", errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(fails ? `\n${fails} FAILED` : "\nALL PASS");
process.exit(fails ? 1 : 0);
