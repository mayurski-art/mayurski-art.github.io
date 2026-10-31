// Trollnite challenges (progression/challenges.js) in a bare page, no game:
//   - three daily, three weekly and the event's four, each with a description,
//     a goal and XP; never two on the same measure in a group;
//   - the same picks for the same day (everyone's day is the same day), new
//     ones the next day and the next week;
//   - a match counts: totals add up, a best-in-one-match measure (streak,
//     wave) keeps the best; Socialize counts for nothing;
//   - a challenge done pays its XP once and sends one inbox message
//     ("trollforces:notify"); finishing it again does nothing;
//   - the event's set is gone once the season ends.
//
// Usage: node tools/troll-ops-challenges-test.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/__blank") { res.writeHead(200, { "content-type": "text/html" }); return res.end("<!doctype html><title>challenges</title>"); }
  const p = path.join(ROOT, decodeURIComponent(url.pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": p.endsWith(".js") ? "text/javascript" : "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}`;

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route(/supabase|github\.io/, (r) => r.abort());
await page.goto(`${BASE}/__blank`);
await page.evaluate(() => localStorage.clear());

const r = await page.evaluate(async () => {
  const C = await import("/assets/games/troll-ops/progression/challenges.js?v=ch1");
  const P = await import("/assets/games/troll-ops/progression/progression.js?v=p5-wst-sb2-fu1-wb1-ar1-ar2-cl1-fj1-zc1-zc2-nf1-or1-rfx1-ret1-mrg1-mrc1-tw1-ars1-p416-mt2-hb4-gc1");
  const notes = [];
  addEventListener("trollforces:notify", (e) => notes.push(e.detail));
  const day = new Date(2026, 9, 31, 12), sameDay = new Date(2026, 9, 31, 22), nextDay = new Date(2026, 10, 1, 9), nextWeek = new Date(2026, 10, 3, 9), after = new Date(2026, 10, 20, 9);
  const v = C.view(day);
  const sig = (g) => g.list.map((c) => c.id).join();
  const groups = Object.fromEntries(v.map((g) => [g.id, g]));
  const out = {
    shape: v.map((g) => [g.id, g.list.length]),
    described: v.every((g) => g.list.every((c) => c.name && c.desc && c.desc.length > 10 && c.goal > 0 && c.xp > 0)),
    distinct: v.filter((g) => g.id !== "event").every((g) => new Set(g.list.map((c) => c.measure)).size === g.list.length),
    sameDay: sig(C.view(sameDay)[0]) === sig(groups.daily),
    newDay: sig(C.view(nextDay)[0]) !== sig(groups.daily),
    sameWeek: sig(C.view(nextDay)[1]) === sig(groups.weekly),   // (Sat 31 Oct and Sun 1 Nov: one week)
    newWeek: sig(C.view(nextWeek)[1]) !== sig(groups.weekly),
    eventAfter: C.view(after).some((g) => g.id === "event"),
  };
  // a social hangout: nothing
  C.onMatch({ mode: "social", kills: 50, won: true, pvp: false }, day);
  out.social = C.view(day).every((g) => g.list.every((c) => c.progress === 0));
  // matches count up: the daily "matches" or "kills" kind moves
  const xp0 = P.getXp();
  C.onMatch({ mode: "tdm", pvp: true, won: true, kills: 9, headshots: 2, assists: 3, streak: 4, wave: 0, map: "hollowgrin" }, day);
  C.onMatch({ mode: "tdm", pvp: true, won: false, kills: 7, headshots: 1, assists: 1, streak: 2, wave: 0, map: "hollowgrin" }, day);
  const after2 = C.view(day);
  const find = (id) => after2.flatMap((g) => g.list).find((c) => c.id === id);
  out.hgKills = find("e-hg-kills")?.progress;          // 9 + 7 summed
  out.hgPlay = find("e-hg-play")?.progress;            // 2 matches
  // a best-in-one measure keeps the best: two Zombies runs, waves 6 then 4
  C.onMatch({ mode: "zombies", kills: 30, wave: 6 }, day);
  C.onMatch({ mode: "zombies", kills: 20, wave: 4 }, day);
  out.wave = find("e-wave10") ? C.view(day).flatMap((g) => g.list).find((c) => c.id === "e-wave10").progress : null;
  // finishing: five Hollowgrin matches finish "Welcome to Hollowgrin" once
  const n0 = notes.length;
  for (let i = 0; i < 5; i++) C.onMatch({ mode: "tdm", pvp: true, kills: 1, map: "hollowgrin" }, day);
  const done = C.view(day).flatMap((g) => g.list).find((c) => c.id === "e-hg-play");
  out.finished = done.done;
  out.notes = notes.slice(n0).filter((n) => /Welcome to Hollowgrin/.test(n.body)).length;
  out.noteKind = notes.find((n) => /Welcome to Hollowgrin/.test(n.body))?.kind;
  out.xpGained = P.getXp() - xp0;
  out.allNotes = notes.length;
  // the next day: daily progress starts again, the event's keeps
  const nd = C.view(nextDay);
  out.dailyFresh = nd[0].list.every((c) => c.progress === 0 || c.measure === "streak");
  out.eventKept = nd.find((g) => g.id === "event").list.find((c) => c.id === "e-hg-play").done;
  out.left = C.timeLeft(new Date(2026, 9, 31, 17, 30), new Date(2026, 9, 31, 12).getTime());
  return out;
});
check("daily 3, weekly 3, event 4", JSON.stringify(r.shape) === JSON.stringify([["daily", 3], ["weekly", 3], ["event", 4]]), JSON.stringify(r.shape));
check("every challenge has a name, a description, a goal and XP", r.described);
check("no two on the same measure in a daily or weekly set", r.distinct);
check("the same picks all day, new ones tomorrow", r.sameDay && r.newDay);
check("the same weekly set Sat to Sun, new on Monday", r.sameWeek && r.newWeek);
check("the event's set is gone after the season", !r.eventAfter);
check("Socialize counts for nothing", r.social);
check("kills add up across matches (Hollowgrin 9 + 7)", r.hgKills === 16, `got ${r.hgKills}`);
check("matches count one each", r.hgPlay === 2, `got ${r.hgPlay}`);
check("a best-in-one measure keeps the best wave (6 then 4)", r.wave === 6, `got ${r.wave}`);
check("five Hollowgrin matches finish it", r.finished);
check("one inbox message for it, a challenge kind", r.notes === 1 && r.noteKind === "challenge", `${r.notes} ${r.noteKind}`);
check("its XP was paid (and others' that finished)", r.xpGained >= 1500, `+${r.xpGained}`);
check("the next day: daily progress starts again, the event's keeps", r.dailyFresh && r.eventKept);
check("time left reads in hours and minutes", r.left === "5H 30M left", r.left);
check("no page errors", !errors.length, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
process.exit(failures ? 1 : 0);
