// Troll Royale in teams, phase 4 (modes/royale-squads.js squadSeats,
// botSquadGoal): the drop together, bot squads stick together.
//   - the seat plan: each party's squad from the start of a plane of its
//     own, its bots right after, every seat taken once;
//   - a match (Mini Royale as Duos, private room, Supabase blocked): our
//     bot teammate rides our plane; 30 m off it comes back to us, 5 m off
//     it's free; in a bot duo the one off on its own goes back to its lead.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-royale-squad-drop-test.mjs
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import os from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = process.env.SHOTS_DIR || os.tmpdir();
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.route(/supabase/, (r) => r.abort());

let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
const src = (f) => fs.readFileSync(path.join(ROOT, "assets/games/troll-ops", f), "utf8");
const MODES_URL = "/assets/games/troll-ops/" + src("game.js").match(/modes\/modes\.js\?v=[\w-]+/)[0];

async function open() {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/frame-ancestors|ERR_FAILED|supabase/i.test(m.text())) errors.push(m.text()); });
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__trollOps && !!window.__toBo2?.fn, null, { timeout: 180000 });
  return page;
}

// ---- a match: Mini Royale (10 trolls) as Duos --------------------------------
async function startDuos(aboard = null) {
  const p = await open();
  await p.evaluate(async ([url, aboard]) => {
    const { MODES } = await import(url);
    MODES.royale_mini_duo = { ...MODES.royale_mini, id: "royale_mini_duo", ffa: false, squad: 2 };
    const T = window.__trollOps;
    T.setMode(aboard ? "royale_duo" : "royale_mini_duo");   // (Troll Beach has no planes: the island for the drop)
    T.els.room.value = "SQD" + Math.floor(Math.random() * 900 + 100);   // a private room: never the public one
    T.els.room.dispatchEvent(new Event("input"));
    if (T.els.noBots) T.els.noBots.checked = false;
    await T.startGame();
  }, [MODES_URL, !!aboard]);
  if (aboard) { await p.waitForFunction(() => { const T = window.__trollOps; return T.royale()?.plane != null && T.bots.bots.some((b) => b.team === T.net.team && b.drop?.state === "aboard"); }, null, { timeout: 180000 }); aboard.v = await p.evaluate(() => { const T = window.__trollOps, mate = T.bots.bots.find((b) => b.team === T.net.team); return { mine: T.royale().plane, mate: mate.drop.plane, slot: mate.dropSlot }; }); }
  await p.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.isStaging() && window.__trollOps.royale()?.live, null, { timeout: 180000 });
  await sleep(800);
  // the bots stand still: their fire would decide who's down
  await p.evaluate(() => { const T = window.__trollOps; T.bots.update = () => {}; T.player.spawnGuard = 0; });
  return p;
}
const SQ_URL = "/assets/games/troll-ops/modes/" + src("modes/royale.js").match(/\.\/royale-squads\.js\?v=[\w-]+/)[0].slice(2);
const ROY_URL = "/assets/games/troll-ops/" + src("modes/match-start.js").match(/\.\/royale\.js\?v=[\w-]+/)[0].replace("./", "modes/");

// ---- the seat plan, on its own ------------------------------------------------
let page = await open();
const plan = await page.evaluate(async (url) => {
  const { squadSeats } = await import(url);
  // two parties (a duo and a lone player) in Squads, 9 seats a plane, 8 planes
  const humans = [{ id: "h1", team: "sA" }, { id: "h2", team: "sB" }, { id: "h3", team: "sA" }];
  const bots = [];
  const add = (team, n) => { for (let i = 0; i < n; i++) bots.push({ id: `${team}-${i}`, team }); };
  add("sA", 2); add("sB", 3); add("b0", 4); add("b1", 4); add("b2", 4);
  const s = squadSeats(humans, bots, 9, 8);
  const planeOf = (id) => Math.floor(s.get(id) / 9);
  const all = [...s.values()];
  return {
    a: ["h1", "h3", "sA-0", "sA-1"].map((id) => s.get(id)), b: ["h2", "sB-0", "sB-1", "sB-2"].map((id) => s.get(id)),
    unique: new Set(all).size === all.length, n: all.length,
    botSquadsSplit: ["b0", "b1", "b2"].map((t) => new Set(bots.filter((b) => b.team === t).map((b) => planeOf(b.id))).size),
  };
}, SQ_URL);
console.log(JSON.stringify(plan));
check(JSON.stringify(plan.a) === "[0,1,2,3]" && JSON.stringify(plan.b) === "[9,10,11,12]", "each party's squad from the start of a plane of its own, its bots right after", JSON.stringify({ a: plan.a, b: plan.b }));
check(plan.unique && plan.n === 20, "every seat taken once", JSON.stringify({ n: plan.n }));
await page.close();

// ---- a match: our teammate rides our plane; bots regroup ---------------------------
const aboard = {};
page = await startDuos(aboard);
const ride = aboard.v || {};
check(ride.mine != null && ride.mine === ride.mate, "our teammate rides our plane", JSON.stringify(ride));
const goal = (dx) => page.evaluate(async ([url, dx]) => {
  const T = window.__trollOps, { royaleBotObjective } = await import(url);
  const b = T.bots.bots.find((x) => x.team === T.net.team);
  b.pos.x = T.move.pos.x + dx; b.pos.z = T.move.pos.z; b.seenId = null;
  return royaleBotObjective(b)?.id || null;
}, [ROY_URL, dx]);
const far = await goal(30), near = await goal(5);
const myId = await page.evaluate(() => window.__trollOps.net.id);
check(far === `squad-${myId}` && !String(near).startsWith("squad-"), "our bot, 30 m off, comes back to us; 5 m off, it's free", JSON.stringify({ far, near }));
const bots2 = await page.evaluate(async (url) => {
  const T = window.__trollOps, { royaleBotObjective } = await import(url);
  const duo = T.bots.bots.filter((b) => b.team === "b0").sort((a, b) => (a.id < b.id ? -1 : 1));
  const [lead, foll] = duo;
  foll.pos.x = lead.pos.x + 35; foll.pos.z = lead.pos.z; foll.seenId = null; lead.seenId = null;
  return { lead: lead.id, foll: royaleBotObjective(foll)?.id || null, leads: royaleBotObjective(lead)?.id || null };
}, ROY_URL);
check(bots2.foll === `squad-${bots2.lead}` && !String(bots2.leads).startsWith("squad-"), "a bot duo: the one off on its own goes back to its lead", JSON.stringify(bots2));
check(errors.length === 0, "no page errors", errors.slice(0, 3).join(" | "));
console.log(`shots: ${SHOTS}`);
await browser.close(); server.close();
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
