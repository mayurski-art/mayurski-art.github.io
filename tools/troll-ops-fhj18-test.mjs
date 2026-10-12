// Troll Forces FHJ-18 AA test (FHJ18.md): the launcher in the Secondary
// slot, its ammo (six a life, a Scavenger pack gives two back), the lock
// (aircraft and enemy SAM Turrets only, ADS, no hip fire), the missile
// downing what it hits, and the bots that carry one.
// Supabase is blocked: the page must never join the live public room.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-fhj18-test.mjs
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GAME = path.join(ROOT, "assets/games/troll-ops");
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
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); if (!ok) failures++; };
// The game's own module instances: the ?v= tag their importers use (any
// other tag is a second copy of the module).
const tagOf = (importer, mod) => fs.readFileSync(path.join(GAME, importer), "utf8").match(new RegExp(`${mod.replace(/[./]/g, "\\$&")}\\?v=([\\w-]+)`))[1];
const TAGS = {
  weapons: tagOf("loadout.js", "weapons.js"),
  scavenger: tagOf("combat/scoring.js", "scavenger.js"),
  perks: tagOf("combat/perk-carry.js", "perks.js"),
};

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.route(/supabase/, (r) => r.abort());
const errors = [];
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(e.message));
// A guest (level 0): the FHJ-18 is open from the start.
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 300000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 300000 });
await page.evaluate(async (tags) => {
  const base = "/assets/games/troll-ops/";
  window.__M = {
    G: (await import(`${base}core/state.js?v=st1`)).game,
    W: await import(`${base}weapons.js?v=${tags.weapons}`),
    SV: await import(`${base}combat/scavenger.js?v=${tags.scavenger}`),
    P: await import(`${base}perks.js?v=${tags.perks}`),
  };
  window.__trollOps.setLoadWaitMax(8);
}, TAGS);

// ---- 1. Create a Class: the Secondary slot offers Launchers, the FHJ-18 open at level 0.
const menu = await page.evaluate(() => {
  const T = window.__trollOps, L = T.loadout, { W } = window.__M;
  const def = W.WEAPON_DEFS.fhj18;
  const valid = L.validClass({ ...L.cur, secondaryId: "fhj18" }).secondaryId;
  return { def: def && { cls: def.cls, rank: def.rank, hidden: !!def.hidden, mag: def.magSize, reserveMax: def.reserveMax },
    secondary: W.SECONDARY_CLASSES, primary: W.CLASS_ORDER.includes("launcher"), valid, inClass: W.weaponsInClass("launcher") };
});
check("the FHJ-18 is a launcher, open from level 0, never Royale loot", menu.def?.cls === "launcher" && menu.def.rank === 0 && menu.def.hidden, JSON.stringify(menu.def));
check("the Secondary slot offers Launchers; the Primary doesn't", menu.secondary.includes("launcher") && !menu.primary && menu.inClass.includes("fhj18"), JSON.stringify(menu));
check("a class can keep it as its secondary", menu.valid === "fhj18", menu.valid);

// ---- 2. In a match: six missiles a life; a Scavenger pack gives two back, never past six.
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.loadout.secondaryId = "fhj18";
  T.setMode("tdm");
  if (T.els.noBots) T.els.noBots.checked = true;
  await T.startGame();
});
await page.waitForFunction(() => !window.__trollOps.loadState().open, null, { timeout: 300000 });
await page.evaluate(() => { const T = window.__trollOps; T.endStaging?.(); T.matchIntro?.skip?.(); });
await page.waitForTimeout(800);
const ammo = await page.evaluate(async () => {
  const T = window.__trollOps, { G, SV, P } = window.__M;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const w = T.player.weapons.fhj18;
  const out = { has: !!w, secondaryId: T.player.secondaryId, mag: w?.ammoInMag, reserve: w?.ammoReserve };
  if (!w) return out;
  const keep = P.carriedPerks();
  P.setCarriedPerks(["scavenger"]);
  w.ammoReserve = 0;
  SV.scavengerDrop(G.player.pos.clone());
  await wait(300);
  out.afterPack = w.ammoReserve;
  w.ammoReserve = 4;
  SV.scavengerDrop(G.player.pos.clone());
  await wait(300);
  out.capped = w.ammoReserve;
  P.setCarriedPerks(keep);
  return out;
});
check("the FHJ-18 is the secondary in the match", ammo.has && ammo.secondaryId === "fhj18", JSON.stringify(ammo));
check("six missiles a life: one in the tube, five spare", ammo.mag === 1 && ammo.reserve === 5, `${ammo.mag} + ${ammo.reserve}`);
check("a Scavenger pack gives two missiles back", ammo.afterPack === 2, String(ammo.afterPack));
check("...never past six", ammo.capped === 5, String(ammo.capped));

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `${failures} failed` : "all passed");
process.exit(failures ? 1 : 0);
