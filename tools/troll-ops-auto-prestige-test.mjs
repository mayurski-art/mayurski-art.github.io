// Trollnite automatic prestige (user, 2026-11-01: "it should be automatic
// after hitting lvl 69 ... all the way until prestige master which is
// prestige 69"), headless, Supabase blocked; window.TrollrunnerAccounts is a
// stub with a fake client (the prestige row, the prestige RPC, XP landing),
// its "server" kept in localStorage so a reload sees the same row.
//  1. XP landing past 69 calls troll_forces_prestige_up once; the level shown
//     goes to 1 and the prestige moment comes up; more XP doesn't call again
//  2. a reload after it doesn't prestige again
//  3. already past 69 when the page loads: it prestiges on load, once
//  4. the server refusing (its SQL still capped at 11): one call, no page
//     errors, the level stays 69, and a reload doesn't try again
//  5. never for a guest past 69 XP, never for the owner
//  6. badges for 1, 10, 11, 25, 68, 69 (SVG and the canvas name-tag ones):
//     a contact sheet, and the banded ones carry their number
//
// Usage: node tools/troll-ops-auto-prestige-test.mjs [outDir]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.resolve(process.argv[2] || path.join(ROOT, "tools", "out"));
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg", ".svg": "image/svg+xml", ".gif": "image/gif" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;
let failures = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail && !ok ? `  (${detail})` : ""}`); if (!ok) failures++; };

// progression.js / rank-icons.js under the tags the game imports them with
// (the same module instances the page runs)
const BO2 = fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/menu/menu-bo2.js"), "utf8");
const PROG = "assets/games/troll-ops/" + BO2.match(/"\.\.\/(progression\/progression\.js\?v=[^"]*)"/)[1];
const LOADOUT = fs.readFileSync(path.join(ROOT, "assets/games/troll-ops/progression/loadout.js"), "utf8");
const ICONS = "assets/games/troll-ops/progression/" + LOADOUT.match(/"\.\/(rank-icons\.js\?v=[^"]*)"/)[1];

const browser = await chromium.launch({ args: ["--use-angle=d3d11"] });

/* A page with a stub account. `srv`: the fake server's starting state
   { user: {id, username, xp} | null, prestige, xp_base, cap, guestXp }. */
async function open(srv, { fresh = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.route(/supabase/, (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|net::|frame-ancestors/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript((init) => {
    if (!localStorage.getItem("fake-server")) {
      localStorage.setItem("fake-server", JSON.stringify({ ...init, rpcCalls: 0 }));
      if (init.guestXp) localStorage.setItem("trollops:guest-xp", String(init.guestXp));
    }
    const S = () => JSON.parse(localStorage.getItem("fake-server"));
    const put = (s) => localStorage.setItem("fake-server", JSON.stringify(s));
    const profile = () => { const s = S(); return s.user ? { ...s.user, level: 30, tags: [] } : null; };
    const client = {
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => {
        const s = S();
        return { data: s.prestige || s.xp_base ? { prestige: s.prestige, xp_base: s.xp_base } : null, error: null };
      } }) }) }),
      rpc: async (name) => {
        const s = S();
        if (name !== "troll_forces_prestige_up") return { data: null, error: { message: "unknown rpc" } };
        s.rpcCalls++;
        const lvl = Math.min(69, Math.floor((-120 + Math.sqrt(14400 + 8 * Math.max(0, s.user.xp - s.xp_base))) / 4) + 1);
        if (s.prestige >= s.cap) { put(s); return { data: null, error: { message: "Already Prestige Master." } }; }
        if (lvl < 69) { put(s); return { data: null, error: { message: "Reach level 69 first." } }; }
        s.prestige++; s.xp_base = s.user.xp;
        put(s);
        return { data: { prestige: s.prestige, xp_base: s.xp_base }, error: null };
      },
    };
    const fake = {
      getCachedProfile: profile,
      getClient: () => (S().user ? client : null),
      // XP lands on the account
      awardXp: async (_ev, _src, meta) => {
        const s = S();
        if (!s.user) return null;
        s.user.xp += meta.xp; put(s);
        return { awarded: meta.xp };
      },
    };
    Object.defineProperty(window, "TrollrunnerAccounts", { configurable: true, get: () => fake, set: () => {} });
  }, srv);
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForFunction(() => !!window.__trollOps?.loadout && !!window.__toBo2, null, { timeout: 180000 });
  await page.waitForTimeout(1500);
  return { ctx, page, errors };
}
const server_ = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("fake-server")));
const state = (page) => page.evaluate(async (spec) => {
  const P = await import(new URL(spec, location.href).href);
  const lvChip = [...document.querySelectorAll("button, span, b, div")].find((e) => e.offsetParent && !e.children.length && /^LV\s*\d+$/.test(e.textContent.trim()));
  return { level: P.getLevel(), prestige: P.getPrestige(), xpText: P.rankXpText(), chip: lvChip?.textContent.trim() || null };
}, PROG);
const addXp = (page, n) => page.evaluate(async ([spec, n]) => {
  const P = await import(new URL(spec, location.href).href);
  P.addXp(n);
  await P.syncXp();
  await new Promise((r) => setTimeout(r, 400));
}, [PROG, n]);

// 1 + 2. crossing 69 in play, then a reload
{
  const { ctx, page, errors } = await open({ user: { id: "u-1", username: "climber", xp: 17300 }, prestige: 0, xp_base: 0, cap: 69 });
  let st = await state(page);
  check("1. a player at 17,300 XP is level 68, no prestige yet", st.level === 68 && st.prestige === 0 && (await server_(page)).rpcCalls === 0, JSON.stringify(st));
  await addXp(page, 200);
  const sv = await server_(page);
  st = await state(page);
  check("1. XP landing past 69 calls the prestige RPC once", sv.rpcCalls === 1 && sv.prestige === 1, JSON.stringify(sv));
  check("1. the level shown goes to 1, Prestige 1", st.level === 1 && st.prestige === 1, JSON.stringify(st));
  check("1. the menu's level chip says LV 1", st.chip === null || st.chip === "LV 1", JSON.stringify(st));
  const moment = await page.evaluate(() => {
    const el = document.querySelector(".to-prestige-moment");
    return el ? { on: el.classList.contains("is-on"), title: el.querySelector("strong")?.textContent, svg: !!el.querySelector("svg.tf-prestige-icon") } : null;
  });
  check("1. the prestige moment comes up: badge + \"Prestige 1\"", moment?.on && moment.svg && moment.title === "Prestige 1", JSON.stringify(moment));
  await page.waitForTimeout(500);
  const shot = path.join(OUT, "prestige-moment.png");
  await page.screenshot({ path: shot });
  console.log(`      screenshot: ${shot}`);
  await addXp(page, 300);
  check("1. more XP after it doesn't prestige again", (await server_(page)).rpcCalls === 1);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__trollOps?.loadout, null, { timeout: 180000 });
  await page.waitForTimeout(2000);
  st = await state(page);
  check("2. a reload doesn't prestige again; still P1, a low level", (await server_(page)).rpcCalls === 1 && st.prestige === 1 && st.level < 10, JSON.stringify(st));
  check("1-2. no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// 3. already past 69 on load
{
  const { ctx, page, errors } = await open({ user: { id: "u-2", username: "afk", xp: 90000 }, prestige: 5, xp_base: 40000, cap: 69 });
  await page.waitForTimeout(500);
  const sv = await server_(page), st = await state(page);
  check("3. already past 69 on load: prestiges on load, once (P5 -> P6, level 1)", sv.rpcCalls === 1 && st.prestige === 6 && st.level === 1, JSON.stringify({ sv, st }));
  check("3. no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// 4. the server's SQL still capped at 11
{
  const { ctx, page, errors } = await open({ user: { id: "u-3", username: "veteran", xp: 500000 }, prestige: 11, xp_base: 300000, cap: 11 });
  await page.waitForTimeout(500);
  let sv = await server_(page), st = await state(page);
  check("4. old SQL refuses past 11: one call, held at 69", sv.rpcCalls === 1 && st.prestige === 11 && st.level === 69, JSON.stringify({ sv, st }));
  check("4. the XP line says Max level (not \"Prestiging…\")", st.xpText === "Max level", st.xpText);
  await addXp(page, 100);
  await addXp(page, 100);
  check("4. XP landing again doesn't retry", (await server_(page)).rpcCalls === 1);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__trollOps?.loadout, null, { timeout: 180000 });
  await page.waitForTimeout(2000);
  sv = await server_(page);
  check("4. a reload doesn't retry either (held for a while)", sv.rpcCalls === 1, JSON.stringify(sv));
  check("4. no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// 5. guest and owner
{
  const { ctx, page, errors } = await open({ user: null, prestige: 0, xp_base: 0, cap: 69, guestXp: 30000 });
  const st = await state(page);
  check("5. a guest past 69 XP: level 69, never prestiges", st.level === 69 && st.prestige === 0 && (await server_(page)).rpcCalls === 0, JSON.stringify(st));
  check("5. guest: no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}
{
  const { ctx, page, errors } = await open({ user: { id: "u-own", username: "troll_runner", xp: 900000 }, prestige: 0, xp_base: 0, cap: 69 });
  await addXp(page, 500);
  const st = await state(page);
  check("5. the owner never prestiges (no level, no call)", st.level === null && (await server_(page)).rpcCalls === 0, JSON.stringify(st));
  check("5. owner: no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// 6. badges contact sheet
{
  const ctx = await browser.newContext({ viewport: { width: 980, height: 380 }, deviceScaleFactor: 1 });
  await ctx.route(/supabase/, (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 180000 });
  const LIST = [1, 10, 11, 25, 68, 69];
  const res = await page.evaluate(async ([spec, list]) => {
    const I = await import(new URL(spec, location.href).href);
    document.body.innerHTML = "";
    document.body.style.cssText = "margin:0;background:#141821;color:#eee;font:14px system-ui;padding:16px";
    const row = (label) => { const r = document.createElement("div"); r.style.cssText = "display:flex;gap:18px;align-items:center;margin-bottom:14px"; const l = document.createElement("b"); l.textContent = label; l.style.width = "80px"; r.append(l); document.body.append(r); return r; };
    const svgRow = row("SVG"), canRow = row("Canvas"), nameRow = row("Name");
    const out = [];
    for (const p of list) {
      const s = document.createElement("div"); s.style.cssText = "width:128px;text-align:center"; s.innerHTML = I.prestigeIconSvg(p, 112);
      svgRow.append(s);
      const c = await I.playerIconCanvas(1, p, false);
      const cw = document.createElement("div"); cw.style.cssText = "width:128px;text-align:center";
      if (c) { const cc = document.createElement("canvas"); cc.width = cc.height = 64; cc.style.cssText = "width:96px;height:96px"; cc.getContext("2d").drawImage(c, 0, 0); cw.append(cc); }
      canRow.append(cw);
      const n = document.createElement("div"); n.style.cssText = "width:128px;text-align:center"; n.textContent = `${p}: ${I.prestigeName(p)}`; nameRow.append(n);
      const svg = s.querySelector("svg");
      out.push({ p, name: I.prestigeName(p), number: svg.querySelector("text")?.textContent || null, canvas: !!c, svgLen: s.innerHTML.length });
    }
    await new Promise((r) => setTimeout(r, 800));
    return out;
  }, [ICONS, LIST]);
  const by = Object.fromEntries(res.map((r) => [r.p, r]));
  check("6. badges render for 1, 10, 11, 25, 68, 69 (SVG and canvas)", res.length === 6 && res.every((r) => r.canvas && r.svgLen > 200), JSON.stringify(res));
  check("6. 1 and 10 keep their plain designs (no number)", by[1].number === null && by[10].number === null, JSON.stringify([by[1], by[10]]));
  check("6. 11, 25, 68 carry their number", by[11].number === "11" && by[25].number === "25" && by[68].number === "68", JSON.stringify(res));
  check("6. 69 is Prestige Master, its own mark (no number)", by[69].name === "Prestige Master" && by[69].number === null && by[68].name === "Prestige 68", JSON.stringify([by[68], by[69]]));
  const sheet = path.join(OUT, "prestige-badges.png");
  await page.screenshot({ path: sheet });
  console.log(`      screenshot: ${sheet}`);
  check("6. no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
