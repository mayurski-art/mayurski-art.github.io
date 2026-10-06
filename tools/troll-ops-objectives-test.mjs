// Troll Forces objective modes (modes/objectives.js): holding the King of
// the Hill scores for your team, and a Search & Destroy round win scores,
// then the next round stages.
//
// Usage: node tools/troll-ops-objectives-test.mjs   (Supabase blocked, private)

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".glb": "model/gltf-binary", ".mp3": "audio/mpeg", ".svg": "image/svg+xml", ".gif": "image/gif" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${typeof detail === "string" ? detail : JSON.stringify(detail)})` : ""}`);
  if (!ok) failures++;
}

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
const errors = [];
async function openMatch(mode) {
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  await page.route(/supabase/, (r) => r.abort());
  page.on("pageerror", (e) => errors.push(`${mode}: ${e.message}`));
  await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`);
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 120000 });
  await page.evaluate(async (mode) => {
    const T = window.__trollOps;
    T.setMode(mode);
    T.loadout.mapId = "grinsite";
    await T.startGame();
    if (T.isStaging?.()) T.endStaging();
  }, mode);
  // The map loads behind its loading screen; wait for the match to be live.
  await page.waitForFunction(() => window.__trollOps.killcam.tracks.size > 5 && !window.__trollOps.isStaging(), null, { timeout: 180000 }).catch(() => {});
  return page;
}

// --- King of the Hill: stand on it alone and your side scores
{
  const page = await openMatch("koth");
  const r0 = await page.evaluate(() => {
    const T = window.__trollOps;
    for (const b of T.bots.bots) b.alive = false;   // nobody contests it
    window.__holdHill = setInterval(() => {
      const h = T.hill();
      if (!h) return;
      for (const b of T.bots.bots) b.alive = false;
      T.player.maxHp = T.player.hp = 1e9;
      T.move.pos.x = h.position.x; T.move.pos.z = h.position.z;
    }, 16);
    return { hill: !!T.hill(), team: T.net.team, score: { ...T.teamScores } };
  });
  check("koth: the match has a hill", r0.hill, r0);
  await page.waitForFunction((r0) => window.__trollOps.teamScores[r0.team] >= r0.score[r0.team] + 3, r0, { timeout: 90000 }).catch(() => {});
  const r1 = await page.evaluate(() => ({ score: { ...window.__trollOps.teamScores } }));
  check("koth: holding the hill scores for your team", r1.score[r0.team] >= r0.score[r0.team] + 3, { before: r0.score, after: r1.score, team: r0.team });
  await page.close();
}

// --- Search & Destroy: a round win scores and the next round stages
{
  const page = await openMatch("snd");
  const r0 = await page.evaluate(() => {
    const T = window.__trollOps;
    const before = { round: T.sndRound(), score: { ...T.teamScores }, sites: (T.bombSites() || []).length, bomb: !!T.bomb() };
    T.sndRoundWin(T.net.team, "TEST");
    return { ...before, team: T.net.team };
  });
  check("snd: the map has bomb sites and a bomb", r0.sites >= 2 && r0.bomb, r0);
  await page.waitForFunction((r0) => window.__trollOps.sndRound() === r0.round + 1, r0, { timeout: 60000 }).catch(() => {});
  const r1 = await page.evaluate(() => ({ round: window.__trollOps.sndRound(), score: { ...window.__trollOps.teamScores }, state: window.__trollOps.state() }));
  check("snd: a round win scores for the winners", r1.score[r0.team] === (r0.score[r0.team] || 0) + 1, { r0, r1 });
  check("snd: the next round starts", r1.round === r0.round + 1 && r1.state === "playing", { r0, r1 });
  await page.close();
}

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `${failures} check(s) failed` : "all objective checks passed");
process.exit(failures ? 1 : 0);
