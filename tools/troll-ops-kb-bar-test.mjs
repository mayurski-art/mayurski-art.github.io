// Troll Forces Socialize: Kabukigrin's bar service (modes/kb-bar.js) and
// being drunk (modes/drunk.js), docs/KB-BAR-SERVICE.md.
//
// Two tabs in one headless browser share a Socialize room over
// BroadcastChannel (Supabase blocked, never a live room). A sits on a bar
// stool and orders; B stands by the bar and watches.
//   1. On a bar stool with empty hands the prompt reads "Order a drink"; the
//      card opens, and an order puts the glass in A's hand after the pour
//      (a bartender turned to pour it).
//   2. A sip of sake adds TIPSY.perSip.sake; green tea takes its share off;
//      the glass goes back when it's empty. The table matches the doc.
//   3. Dizzy: at 6.8 a forced spell lurches the view, blurs the picture and
//      closes the edges in; B reads A's `dz` 1.
//   4. Passing out at the cap: slump (dz 2), off the stool (dz 3; B's rig of
//      A tipped on its side), black, then up with the meter at the wake
//      level and a grace period; B reads each phase.
// Shots in tools/.kb-bar-shots/.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-kb-bar-test.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = path.join(ROOT, "tools", ".kb-bar-shots");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp4": "video/mp4" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;

let failures = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); if (!ok) failures++; };
fs.mkdirSync(SHOTS, { recursive: true });
// the modules as the game loads them (the same ?v= tags: one instance)
const G = path.join(ROOT, "assets/games/troll-ops");
const tagOf = (file, mod) => fs.readFileSync(path.join(G, file), "utf8").match(new RegExp(`"[./]*(?:[a-z-]+/)?${mod.replace(".", "\\.")}\\?v=([^"]+)"`))[1];
const RP = `/assets/games/troll-ops/modes/social-rp.js?v=${tagOf("view/player-update.js", "social-rp.js")}`;
const SB = `/assets/games/troll-ops/maps/saloon-bar.js?v=${tagOf("modes/social-rp.js", "saloon-bar.js")}`;

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 560 } });
await ctx.route(/supabase/, (r) => r.abort());
const errors = [];
const pages = [];

/* Headless pages only draw (and so only send state and tick clocks) when
   something asks for a frame: screenshots ask, round the tabs. */
async function pump(ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) for (const p of pages) await p.screenshot({ type: "jpeg", quality: 10 }).catch(() => {});
}
async function open(label, user) {
  const page = await ctx.newPage();
  page.label = label;
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  await page.addInitScript((user) => {
    const fake = { getCachedProfile: () => (user ? { username: user, tags: [] } : null) };
    Object.defineProperty(window, "TrollrunnerAccounts", { configurable: true, get: () => fake, set: () => {} });
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
  }, user);
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 420000 });
  await page.waitForFunction(() => !!window.__trollOps && !!window.__trollClub && !!window.__trollDrunk && !!window.__trollKbBar, null, { timeout: 420000 });
  await page.evaluate(() => window.__trollOps.setLoadWaitMax(8));
  await page.evaluate(async () => {
    const T = window.__trollOps;
    T.setMode("social");
    T.loadout.mapId = "kabukigrin";
    await T.startGame();
  });
  await page.waitForFunction(() => !window.__trollOps.loadState().open, null, { timeout: 420000 });
  // out of the club's line (Socialize starts you in it), the pause menu away
  // past the door's line, with a band on (modes/club-entry.js: inside without one, the door puts you out)
  await page.evaluate(() => { window.__trollOps.els.pause.hidden = true; window.__trollClub.pass(); });
  pages.push(page);
  await pump(400);
  return page;
}
const S = (page) => page.evaluate(() => {
  const T = window.__trollOps, D = window.__trollDrunk.state(), K = window.__trollKbBar;
  const peers = [...T.remotes.byId.values()].map((rp) => ({ id: rp.peer.id, dz: rp.peer.dz | 0, seat: rp.peer.seat | 0, drink: rp.peer.drink | 0, rotZ: +rp.rig.root.rotation.z.toFixed(2), alive: rp.alive }));
  return { me: T.net.id, bar: T.bar(), seated: T.rp().seated, drunk: D, menu: K.kbBar.open, pouring: !!K.kbBar.pouring, pos: [+T.move.pos.x.toFixed(2), +T.move.pos.y.toFixed(2), +T.move.pos.z.toFixed(2)], peers,
    bartenderPouring: (T.townNpcs()?.list || []).some((n) => n.kbBack > 0) };
});
/* Pump every tab until `pred(states)` (one state per tab) or `ms`. */
async function until(pred, ms) {
  const t0 = Date.now();
  let s = await Promise.all(pages.map(S));
  while (Date.now() - t0 < ms && !pred(s)) { await pump(150); s = await Promise.all(pages.map(S)); }
  return s;
}

let bg = true;
const bgPump = (async () => { while (bg) { if (pages.length) await pump(300); else await new Promise((r) => setTimeout(r, 200)); } })();
const A = await open("A", "kb_a");
const B = await open("B", null);
bg = false;
await bgPump;
await pump(1500);
let s = await Promise.all(pages.map(S));
const idA = s[0].me;
check("B sees A in the room", s[1].peers.some((p) => p.id === idA), JSON.stringify(s[1].peers));

/* ---- 1. the stool, the card, the pour */
const seat = await A.evaluate(async (RP) => {
  const rp = await import(RP), T = window.__trollOps;
  const seats = rp.rpSeats();
  const i = seats.findIndex((x, k) => x.bar && !rp.seatTaken(k));
  T.move.pos.set(seats[i].x, seats[i].floor, seats[i].z);
  rp.sitDown(i);
  return { i, ...seats[i] };
}, RP);
// B by the bar, looking along it at A
await B.evaluate(([x, z]) => { const T = window.__trollOps; T.move.pos.set(x - 2.9, 0, z + 1.6); T.look.yaw = Math.atan2(-(x - (x - 2.9)), -(z - (z + 1.6))); T.look.pitch = -0.08; }, [seat.x, seat.z]);
s = await until((ss) => ss[0].bar.prompt === "Order a drink" && ss[1].peers.find((p) => p.id === idA)?.seat === seat.i + 1, 8000);
check("on a bar stool: the prompt reads Order a drink", s[0].bar.prompt === "Order a drink", `prompt ${JSON.stringify(s[0].bar.prompt)}`);
check("B sees A in the seat", s[1].peers.find((p) => p.id === idA)?.seat === seat.i + 1, JSON.stringify(s[1].peers));
await A.evaluate(() => window.__trollKbBar.openMenu());
s = await until((ss) => ss[0].menu && ss[0].bar.prompt === "Pick a drink", 4000);
check("the card opens", s[0].menu && s[0].bar.prompt === "Pick a drink", `prompt ${JSON.stringify(s[0].bar.prompt)}`);
await A.screenshot({ path: path.join(SHOTS, "1-menu.png") });
const took = await A.evaluate(() => window.__trollKbBar.orderDrink("me", "sake"));
check("orderDrink(me, sake) is taken", took === true);
s = await until((ss) => ss[0].pouring, 2000);
check("a bartender turns to pour", s[0].pouring && s[0].bartenderPouring && !s[0].menu, `pouring ${s[0].pouring} bartender ${s[0].bartenderPouring}`);
s = await until((ss) => ss[0].bar.drink?.kind === "sake", 12000);
check("the sake lands in A's hand", s[0].bar.drink?.kind === "sake" && s[0].bar.drink.sips === 1, JSON.stringify(s[0].bar.drink));
s = await until((ss) => ss[1].peers.find((p) => p.id === idA)?.drink === 51, 6000);
check("B sees the ochoko in A's hand (dk 51)", s[1].peers.find((p) => p.id === idA)?.drink === 51, JSON.stringify(s[1].peers));
await A.screenshot({ path: path.join(SHOTS, "2-sake-in-hand.png") });
const refused = await A.evaluate(() => window.__trollKbBar.orderDrink("me", "sour"));
check("hands full: a second order is refused", refused === false);

/* ---- 2. sips and the table */
const sip = async (page) => { await page.evaluate(() => window.__trollOps.setTrigger(true)); await pump(250); await page.evaluate(() => window.__trollOps.setTrigger(false)); };
await sip(A);
s = await until((ss) => !ss[0].bar.drink, 10000);
check("one sip of sake: the cup goes back, +1.2", !s[0].bar.drink && Math.abs(s[0].bar.tipsy - 1.2) < 0.08, `tipsy ${s[0].bar.tipsy.toFixed(2)}`);
await A.evaluate(() => window.__trollKbBar.orderDrink("me", "tea"));
s = await until((ss) => ss[0].bar.drink?.kind === "tea", 12000);
check("green tea comes in a yunomi, two sips", s[0].bar.drink?.kind === "tea" && s[0].bar.drink.sips === 2, JSON.stringify(s[0].bar.drink));
await sip(A);
s = await until((ss) => ss[0].bar.drink?.sips === 1, 10000);
check("a sip of tea takes 0.4 off", s[0].bar.drink?.sips === 1 && Math.abs(s[0].bar.tipsy - 0.8) < 0.08, `tipsy ${s[0].bar.tipsy.toFixed(2)}`);
const table = await A.evaluate(async (SB) => { const sb = await import(SB); return { per: { ...sb.TIPSY.perSip }, cap: sb.TIPSY.cap, max: ["sake", "highball", "sour", "tea"].map(sb.drinkMax), codes: ["sake", "highball", "sour", "tea"].map((k) => sb.drinkCode({ kind: k, sips: 1 })), back: sb.drinkFromCode(63) }; }, SB);
check("the table matches the doc", table.per.sake === 1.2 && table.per.highball === 0.4 && table.per.sour === 0.9 && table.per.tea === -0.4 && table.cap === 8
  && table.max.join() === "1,3,2,2" && table.codes.join() === "51,61,71,81" && table.back?.kind === "highball" && table.back.sips === 3, JSON.stringify(table));
await A.evaluate(async (RP) => { const rp = await import(RP); rp.putDownDrink(); }, RP);

/* ---- 3. a dizzy spell */
await A.evaluate(() => { window.__trollOps.barState.tipsy = 6.8; window.__trollDrunk.drunk.next = 0.01; });
s = await until((ss) => ss[0].drunk.phase === 1 && ss[0].drunk.t > 0.35, 8000);
const D = s[0].drunk;
check("a spell: the view lurches", D.phase === 1 && Math.abs(D.view.roll) > 0.03 && D.view.shove !== 0 && D.view.slow < 1, JSON.stringify(D.view));
check("the picture blurs, the edges close in", /blur\(/.test(D.filter) && +D.vignette > 0.2, `filter ${D.filter} vignette ${D.vignette}`);
await A.screenshot({ path: path.join(SHOTS, "3-dizzy.png") });
s = await until((ss) => ss[1].peers.find((p) => p.id === idA)?.dz === 1, 4000);
check("B reads A's dz 1", s[1].peers.find((p) => p.id === idA)?.dz === 1, JSON.stringify(s[1].peers));
check("the next spell is sooner than the first would be", D.next > 0 && D.next < 40, `next ${D.next.toFixed(1)}`);

/* ---- 4. passing out */
await A.evaluate(() => { window.__trollOps.barState.tipsy = 8; });
s = await until((ss) => ss[0].drunk.phase === 2, 8000);
check("at the cap: the slump (dz 2), still in the seat, the drink gone", s[0].drunk.phase === 2 && s[0].seated && !s[0].bar.drink, JSON.stringify({ phase: s[0].drunk.phase, seated: s[0].seated }));
await pump(300);
await A.screenshot({ path: path.join(SHOTS, "4-slump.png") });
// (slow frames can carry A past the slump before B's next snapshot: 2 or 3)
s = await until((ss) => ss[1].peers.find((p) => p.id === idA)?.dz >= 2, 4000);
check("B reads dz 2 (or already 3)", s[1].peers.find((p) => p.id === idA)?.dz >= 2, JSON.stringify(s[1].peers));
await B.screenshot({ path: path.join(SHOTS, "5-slump-seen-by-b.png") });
s = await until((ss) => ss[0].drunk.phase === 3, 10000);
check("off the stool (dz 3): the seat given up, at its standing spot", s[0].drunk.phase === 3 && !s[0].seated && Math.hypot(s[0].pos[0] - seat.stand.x, s[0].pos[2] - seat.stand.z) < 0.1, JSON.stringify({ pos: s[0].pos, stand: seat.stand }));
s = await until((ss) => ss[0].drunk.t > 0.9 && ss[1].peers.find((p) => p.id === idA)?.dz === 3 && Math.abs(ss[1].peers.find((p) => p.id === idA)?.rotZ) > 1.2, 8000);
const aOnB = s[1].peers.find((p) => p.id === idA);
check("B sees A down: dz 3, the rig on its side", aOnB?.dz === 3 && Math.abs(aOnB.rotZ) > 1.2, JSON.stringify(aOnB));
await B.screenshot({ path: path.join(SHOTS, "6-fall-seen-by-b.png") });
check("A's screen is black", +s[0].drunk.black >= 0.8 && Math.abs(s[0].drunk.view.roll) > 1, `black ${s[0].drunk.black} roll ${s[0].drunk.view.roll.toFixed(2)}`);
await A.screenshot({ path: path.join(SHOTS, "7-blackout.png") });
s = await until((ss) => ss[0].drunk.phase === 4, 20000);
check("coming round (dz 4)", s[0].drunk.phase === 4);
s = await until((ss) => ss[0].drunk.phase === 0 && !ss[0].drunk.out, 20000);
check("up: the meter at the wake level, a grace period, no spell pending yet", s[0].drunk.phase === 0 && Math.abs(s[0].bar.tipsy - 4.5) < 0.1 && s[0].drunk.grace > 20 && !/blur/.test(s[0].drunk.filter) && +s[0].drunk.black < 0.05,
  JSON.stringify({ tipsy: s[0].bar.tipsy, grace: s[0].drunk.grace, filter: s[0].drunk.filter, black: s[0].drunk.black }));
await A.screenshot({ path: path.join(SHOTS, "8-awake.png") });
s = await until((ss) => ss[1].peers.find((p) => p.id === idA)?.dz === 0, 6000);
check("B sees A up (dz 0, upright)", s[1].peers.find((p) => p.id === idA)?.dz === 0 && Math.abs(s[1].peers.find((p) => p.id === idA)?.rotZ) < 0.1, JSON.stringify(s[1].peers));
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close(); server.close();
console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
process.exit(failures ? 1 : 0);
