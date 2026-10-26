// Troll Royale "Record my match" (modes/royale-record.js): the menu row shows
// under the modes while Troll Royale is picked, the canvas is filmed from the
// moment staging ends, the recorder stops the moment you die, and Save
// recording (Esc menu while spectating, the results screen after) downloads a
// non-empty .webm named troll-royale-YYYYMMDD-HHMM.webm. The next match frees
// the clip. Private room, solo against bots.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-royale-record-test.mjs

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
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, acceptDownloads: true });
await ctx.route(/supabase/, (r) => r.abort());
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps && !!window.__trollRoyaleRecord, null, { timeout: 120000 });

const REC = () => page.evaluate(() => window.__trollRoyaleRecord.royaleRecordState());

// ---- the menu row: Private Match, Troll Royale picked
const menu = await page.evaluate(async () => {
  const R = window.__trollRoyaleRecord;
  try { localStorage.removeItem("trollops:royaleRecord"); } catch {}
  const navText = () => [...document.querySelectorAll(".to-bo2-panel button, nav button, [role=menu] button, button")].map((b) => b.textContent.trim());
  const clickText = (t) => { const b = [...document.querySelectorAll("button")].find((x) => x.offsetParent && x.textContent.trim().startsWith(t)); b?.click(); return !!b; };
  const out = { supported: R.recordSupported() };
  out.openedPrivate = clickText("Private Match");
  await new Promise((r) => setTimeout(r, 300));
  out.tdmRow = navText().some((t) => t.startsWith("Record my match"));
  out.pickedRoyale = clickText("Troll Royale");
  await new Promise((r) => setTimeout(r, 300));
  const row = [...document.querySelectorAll("button")].find((x) => x.offsetParent && x.textContent.trim().startsWith("Record my match"));
  out.royaleRow = !!row;
  out.before = row?.textContent.trim();
  row?.click();
  await new Promise((r) => setTimeout(r, 200));
  out.after = [...document.querySelectorAll("button")].find((x) => x.offsetParent && x.textContent.trim().startsWith("Record my match"))?.textContent.trim();
  out.pref = R.recordPref();
  out.stored = localStorage.getItem("trollops:royaleRecord");
  return out;
});
check("this browser can record (canvas capture + MediaRecorder)", menu.supported);
check("Private Match: no record row while TDM is picked", menu.openedPrivate && !menu.tdmRow, JSON.stringify({ opened: menu.openedPrivate, tdmRow: menu.tdmRow }));
check("Troll Royale picked: a Record my match row, Off at first", menu.pickedRoyale && menu.royaleRow && /Off/.test(menu.before || ""), menu.before);
check("selecting it turns it On and saves it under trollops:royaleRecord", /On/.test(menu.after || "") && menu.pref && menu.stored === "1", JSON.stringify({ after: menu.after, stored: menu.stored }));

// ---- a private Royale against bots (no plane: straight to "DROP IN")
const room = `RR${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;   // room codes are 5 characters
await page.evaluate(async (room) => {
  const T = window.__trollOps;
  window.__trollRoyaleRecord.setRecordPref(true);
  T.DROP.enabled = false;
  T.setMode("royale");
  T.els.noBots.checked = false;
  T.els.room.value = room;
  T.els.room.dispatchEvent(new Event("input"));
  await T.startGame();
}, room);
await page.waitForFunction(() => window.__trollOps.state() === "playing" && !window.__trollOps.loadState().open, null, { timeout: 240000 });
const inRoom = await page.evaluate(() => window.__trollOps.net.room);
check("the match is in the private room", inRoom === room, `${inRoom}`);
const staging = await REC();
check("nothing is filmed during the countdown", !staging.recording && !staging.clip, JSON.stringify(staging));
await page.evaluate(() => { const T = window.__trollOps; if (T.isStaging()) T.endStaging(); T.player.spawnGuard = 1e9; });
await page.waitForFunction(() => window.__trollRoyaleRecord.royaleRecordState().recording, null, { timeout: 10000 }).catch(() => {});
const live = await REC();
check("filming starts as the match goes live", live.recording, `${live.mime}`);
check("a REC dot is up, and nothing else", await page.evaluate(() => { const d = document.querySelector(".to-rec-dot"); return !!d && !d.hidden && d.textContent === ""; }));

await sleep(4000);   // play a few seconds (bots move, the zone runs)

// ---- kill the player
const death = await page.evaluate(() => {
  const T = window.__trollOps;
  T.player.spawnGuard = 0; T.player.armor = 0;
  const wasAlive = T.player.alive;
  T.damagePlayer(9999, null, "zone");
  const s = window.__trollRoyaleRecord.royaleRecordState();
  return { wasAlive, alive: T.player.alive, recording: s.recording, dot: document.querySelector(".to-rec-dot")?.hidden };
});
check("the player dies", death.wasAlive && !death.alive, JSON.stringify(death));
check("the recorder stops the moment you die", !death.recording && death.dot === true, JSON.stringify(death));
await page.waitForFunction(() => !!window.__trollRoyaleRecord.royaleRecordState().clip, null, { timeout: 10000 }).catch(() => {});
const after = await REC();
check("a clip is waiting, cut at the death", after.clip?.reason === "death" && after.clip.size > 20000, JSON.stringify(after.clip));
check("it's named troll-royale-YYYYMMDD-HHMM.webm", /^troll-royale-\d{8}-\d{4}\.webm$/.test(after.clip?.name || ""), after.clip?.name);
const head = await page.evaluate(async () => {
  const b = window.__trollRoyaleRecord.clipBlob();
  const u = new Uint8Array(await b.slice(0, 4).arrayBuffer());
  return { type: b.type, ebml: [...u].map((x) => x.toString(16).padStart(2, "0")).join("") };
});
check("it's a WebM (EBML header)", head.type === "video/webm" && head.ebml === "1a45dfa3", JSON.stringify(head));
await sleep(1500);
const later = await REC();
check("spectating doesn't add to it", later.clip?.size === after.clip?.size && !later.recording, `${after.clip?.size} -> ${later.clip?.size}`);

// ---- Save from the Esc menu while spectating
const pauseBtn = await page.evaluate(() => { window.__trollOps.openPauseMenu(); const b = document.querySelector("#to-pause .to-rec-save"); return { shown: !!b && !b.hidden && !!b.offsetParent, text: b?.textContent }; });
check("Esc menu: a Save recording button", pauseBtn.shown && pauseBtn.text === "Save recording", JSON.stringify(pauseBtn));
const [dl1] = await Promise.all([page.waitForEvent("download", { timeout: 10000 }), page.click("#to-pause .to-rec-save")]);
const p1 = await dl1.path();
const size1 = p1 ? fs.statSync(p1).size : 0;
check("Save recording downloads the clip", dl1.suggestedFilename() === after.clip.name && size1 === after.clip.size, `${dl1.suggestedFilename()} ${size1} bytes`);
await page.evaluate(() => window.__trollOps.closePauseMenu());

// ---- the results screen
await page.evaluate(() => window.__trollOps.endMatch("The Cringe wins"));
await sleep(500);
const go = await page.evaluate(() => { const b = document.querySelector("#to-gameover .to-rec-save"); return { screen: !document.getElementById("to-gameover").hidden, shown: !!b && !b.hidden && !!b.offsetParent }; });
check("results screen: a Save recording button", go.screen && go.shown, JSON.stringify(go));
const [dl2] = await Promise.all([page.waitForEvent("download", { timeout: 10000 }), page.click("#to-gameover .to-rec-save")]);
const p2 = await dl2.path();
const bytes = p2 ? fs.readFileSync(p2) : Buffer.alloc(0);
check("the results-screen save is the same non-empty webm", bytes.length === after.clip.size && bytes.subarray(0, 4).toString("hex") === "1a45dfa3", `${bytes.length} bytes`);

// ---- the next match frees it
const freed = await page.evaluate(async () => {
  const T = window.__trollOps, url = window.__trollRoyaleRecord.royaleRecordState().clip?.url;
  T.setupRoyale();
  const s = window.__trollRoyaleRecord.royaleRecordState();
  let gone = false;
  try { await fetch(url); } catch { gone = true; }
  return { clip: s.clip, gone, buttonsHidden: s.buttons.every((b) => b.hidden) };
});
check("the next match frees the clip (blob URL revoked, buttons hidden)", !freed.clip && freed.gone && freed.buttonsHidden, JSON.stringify(freed));

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `${failures} failed` : "all passed");
process.exit(failures ? 1 : 0);
