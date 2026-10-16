// Troll Forces: Undergrin's ambience is the bright station's, and it plays.
//
// Phase 5 of UNDERGRIN-METRO.md swapped the old dark-fog set (gusty tunnel
// wind, drips, creaks, a stuttering tube) for tube hum, PA chimes and trains.
// This renders the preset's beds and one of each event through an
// OfflineAudioContext with ambience.js's own code, and checks each one makes
// sound (no silent or NaN graph) and none clips; and that the dark set's
// events are gone from it. No page, no room: just the module.
//
// Usage: node tools/troll-ops-ambience-test.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PAGE = `<!doctype html><meta charset="utf-8"><body>ambience</body>`;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/__amb.html") { res.writeHead(200, { "content-type": "text/html" }); return res.end(PAGE); }
  const p = path.join(ROOT, decodeURIComponent(url.pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": p.endsWith(".js") ? "text/javascript" : "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;
const browser = await chromium.launch();
const page = await browser.newPage();
await page.route(/supabase/, (r) => r.abort());
await page.goto(`${BASE}/__amb.html`);

const out = await page.evaluate(async () => {
  const { MapAmbience } = await import("/assets/games/troll-ops/sound/ambience.js");
  const RATE = 22050;
  // GameAudio's surface that ambience.js uses, over an offline context.
  const fake = (secs) => {
    const ctx = new OfflineAudioContext(2, RATE * secs, RATE);
    const noise = ctx.createBuffer(1, RATE * 2, RATE);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return { ctx, master: ctx.destination, noise, get now() { return ctx.currentTime; }, _ready: () => true };
  };
  const stats = (buf) => {
    let peak = 0, sum = 0, n = 0, nan = false;
    for (let c = 0; c < buf.numberOfChannels; c++) {
      for (const v of buf.getChannelData(c)) { if (Number.isNaN(v)) nan = true; peak = Math.max(peak, Math.abs(v)); sum += v * v; n++; }
    }
    return { peak: +peak.toFixed(4), rms: +Math.sqrt(sum / n).toFixed(5), nan };
  };
  const res = {};
  // the beds alone (events can't fire: their timers never run offline)
  {
    const a = fake(4);
    const amb = new MapAmbience(a);
    amb.level = 1;
    amb.set("undergrin");
    for (const t of amb._timers) clearTimeout(t);
    res.beds = stats(await a.ctx.startRendering());
  }
  // one of each event, with nothing else playing
  for (const kind of ["pa", "arrival", "train"]) {
    const a = fake(14);
    const amb = new MapAmbience(a);
    amb.bus = a.ctx.createGain();
    amb.bus.connect(a.master);
    amb._event(kind, 1);
    res[kind] = stats(await a.ctx.startRendering());
  }
  // which events the preset schedules: count _loop calls by kind
  {
    const a = fake(1);
    const amb = new MapAmbience(a);
    const kinds = [];
    amb._loop = (k) => kinds.push(k);
    amb.set("undergrin");
    res.events = kinds;
  }
  return res;
});
await browser.close();
server.close();

let fail = 0;
const check = (ok, msg) => { console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`); if (!ok) fail++; };
for (const k of ["beds", "pa", "arrival", "train"]) {
  const s = out[k];
  check(!s.nan && s.rms > 0.0005 && s.peak < 1, `undergrin ${k}: rms ${s.rms}, peak ${s.peak}${s.nan ? ", NaN" : ""}`);
}
const ev = out.events;
check(["pa", "arrival", "train"].every((k) => ev.includes(k)), `undergrin schedules PA, arrivals and trains (${ev.join(", ")})`);
check(!ev.some((k) => ["drip", "creak", "buzz"].includes(k)), "the dark set's drips, creaks and buzzing tube are gone");
console.log(fail ? `\n${fail} failed` : "\nall passed");
process.exit(fail ? 1 : 0);
