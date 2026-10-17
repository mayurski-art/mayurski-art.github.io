// Troll Forces Free-for-All (user, 2026-10-17): the mode is listed, bots
// fill a PRIVATE room (Supabase is blocked; never a public room) and fight
// each other with nobody on a side, scorestreaks are allowed, the scoreboard
// is one list, and 30 kills ends it for whoever got there.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-ffa-test.mjs
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
await ctx.route(/supabase/, (r) => r.abort());

let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ROOM = "FF" + String(Math.floor(Math.random() * 900 + 100));
const errors = [];

const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 180000 });

const listed = await page.evaluate(() => [...document.querySelectorAll("#to-lo-mode .to-lo-modebtn, .to-lo-modebtn")].map((b) => b.dataset.mode));
check(listed.includes("ffa") && listed.indexOf("ffa") === listed.indexOf("tdm") + 1, "Free-for-All is listed right after TDM", listed.join(","));

await page.evaluate(async (room) => {
  const T = window.__trollOps;
  T.setMode("ffa");
  T.els.noBots.checked = false;
  T.els.room.value = room;
  T.els.room.dispatchEvent(new Event("input"));
  T.loadout.versusMapId = "grinsite";
  await T.startGame();
}, ROOM);
await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.loadState().open, null, { timeout: 240000 });
await page.evaluate(() => { const T = window.__trollOps; if (T.isStaging()) T.endStaging(); T.settings.invincible = true; });

const rules = await page.evaluate(async () => {
  const T = window.__trollOps;
  const { MODES } = await import("/assets/games/troll-ops/modes/modes.js");
  const m = MODES[T.modeId()];
  return { id: T.modeId(), ffa: !!m.ffa, limit: m.scoreLimit, noStreaks: !!m.noStreaks };
});
check(rules.id === "ffa" && rules.ffa && rules.limit === 30 && !rules.noStreaks, "FFA rules: no sides, limit 30, streaks on", JSON.stringify(rules));

// Let the bots fight. In free-for-all a bot can kill any other bot.
let botKills = 0, bots = 0;
for (let i = 0; i < 90 && botKills < 2; i++) {
  await sleep(500);
  ({ botKills, bots } = await page.evaluate(() => {
    const T = window.__trollOps;
    return { bots: T.bots.bots.length, botKills: T.bots.bots.reduce((s, b) => s + (b.kills | 0), 0) };
  }));
}
check(bots >= 3, "bots fill the room", `bots=${bots}`);
check(botKills >= 2, "bots kill each other with no sides", `botKills=${botKills}`);

const board = await page.evaluate(() => {
  const T = window.__trollOps;
  T.renderScoreboard();
  const el = T.els.scoreboard;
  return { text: el.textContent.slice(0, 400), sides: el.querySelectorAll("[data-team], .to-sb-team").length };
});
check(!/Trolls|Jeets/.test(board.text), "scoreboard is one list, no sides", board.text.slice(0, 120));

const streaksOk = await page.evaluate(() => { const T = window.__trollOps; T.awardScore(250); return T.streaks.ready?.size ?? T.readyStreaksOrdered().length; });
check(streaksOk > 0, "scorestreaks can be earned", `ready=${streaksOk}`);

// 30 kills ends it for us.
await page.evaluate(() => {
  const T = window.__trollOps;
  T.player.kills = 29;
  const b = T.bots.bots.find((x) => x.alive) || T.bots.bots[0];
  T.registerDeath(b.name, T.net.id, "pistol", { victimId: b.id, victimBot: true, victimTeam: b.team });
});
await sleep(800);
const end = await page.evaluate(() => {
  const T = window.__trollOps;
  return { state: T.state(), kills: T.player.kills, title: document.getElementById("to-go-title")?.textContent || "" };
});
check(end.kills >= 30, "the 30th kill registers", JSON.stringify(end));
check(end.state !== "playing" && end.title === "You win", "30 kills ends the match with a winner", JSON.stringify(end));

check(!errors.length, "no page errors", errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
