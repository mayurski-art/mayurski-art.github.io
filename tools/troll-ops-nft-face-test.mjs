// Troll Forces cosmetics: a TROLLS NFT body takes the face pieces off
// (user, 2026-10-12): picking the body unequips the expression and the face
// covering (the wrist stays), their cards lock, picking one does nothing,
// the face worn and sent on the wire is the plain one, and taking the body
// off unlocks them again. The owner account is stood in for by a cached
// profile (no sign-in, Supabase blocked).
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-nft-face-test.mjs
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const browser = await chromium.launch();
const page = await browser.newPage();
await page.route(/supabase/, (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };

// a sad face, a bandana and a watch already on, saved from an earlier visit
await page.addInitScript(() => {
  localStorage.setItem("trollops:cosmetics", JSON.stringify({ face: "sad:og:bandana-red:rolex-gold", body: "" }));
  const profile = { username: "troll_runner" };
  Object.defineProperty(window, "TrollrunnerAccounts", { configurable: true, get: () => window.__acct, set: (v) => { window.__acct = v; if (v) v.getCachedProfile = () => profile; } });
});
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });
if (!(await page.evaluate(() => !!window.TrollrunnerAccounts))) await page.evaluate(() => { window.TrollrunnerAccounts = {}; });

const state = () => page.evaluate(() => {
  const T = window.__trollOps;
  const box = document.getElementById("to-cos-body");
  const on = (sel) => [...box.querySelectorAll(sel)].filter((b) => b.classList.contains("is-on")).map((b) => b.dataset.expr || b.dataset.cover || b.dataset.wrist || b.dataset.body || "none");
  const locked = (sel) => [...box.querySelectorAll(sel)].every((b) => b.getAttribute("aria-disabled") === "true");
  return {
    face: T.localRig.face,
    wire: (() => { const src = T.charInspector.humanoid.face; return src; })(),
    expr: on("[data-expr]"), cover: on("[data-cover]"), wrist: on("[data-wrist]"),
    exprLocked: locked("[data-expr]"), coverLocked: locked("[data-cover]"),
  };
});
const click = (sel) => page.evaluate((sel) => document.querySelector(`#to-cos-body ${sel}`).click(), sel);

let s = await state();
check(/^sad:og:bandana-red:rolex-gold$/.test(s.face), "before: the sad face, a bandana and a watch", s.face);
await click('[data-body="trolls-1718"]');
s = await state();
check(s.face === "grin:og::rolex-gold", "the TROLLS body: expression and covering off, the watch kept", s.face);
check(s.wire === s.face, "the menu operator wears the same", s.wire);
check(s.exprLocked && s.coverLocked, "face and covering cards locked");
check(!s.expr.length && !s.cover.length && s.wrist.includes("rolex-gold"), "no face card ticked, the watch still is", JSON.stringify(s));
await click('[data-expr="sad"]');
await click('[data-cover="bandana-blue"]');
s = await state();
check(s.face === "grin:og::rolex-gold", "picking the sad face or a bandana does nothing", s.face);
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("trollops:cosmetics")));
check(saved.face === "grin:og::rolex-gold" && saved.body === "trolls-1718", "and that's what's saved", JSON.stringify(saved));
await click('[data-body=""]');
s = await state();
check(!s.exprLocked && !s.coverLocked, "back to the stick troll: unlocked again");
await click('[data-expr="sad"]');
s = await state();
check(s.face.startsWith("sad:"), "and the sad face goes on", s.face);
check(errors.length === 0, "no page errors", errors.join(" | "));
console.log(fails ? `${fails} FAILED` : "ALL PASS");
await browser.close(); server.close();
process.exit(fails ? 1 : 0);
