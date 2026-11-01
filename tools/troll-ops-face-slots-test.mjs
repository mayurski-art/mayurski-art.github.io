// Troll Forces — the face in three slots, and what a head piece covers
// (user, 2026-11-01: the Faces list was "confusing like i can wear one thing
// but not the other"; "if a nft character has hair then wearing the pumpkin
// hat doesnt show the hair sticking out ... the cowboy hat as well"; "the
// way the bandit bandana appears is weird").
//
//   the Face screen: Expression, Covering and Head rows, each its own list;
//   a covering or an expression picked under the Pumpkin Head takes it off;
//     the Cosmetics row sums it up ("Grin + Red bandana", "Pumpkin Head");
//   a TROLLS body: Expression and Covering off, Head still there;
//   the bandana on the 3D trollface: laid on the face itself (a skin of its
//     shape in the relief head), not the flat board's cards;
//   every TROLLS body under the Pumpkin Head: nothing that shows sticks out
//     of the pumpkin at head height (its hair, hat, horns, beard, glasses),
//     on every token in cosmetics.js BODIES, so a new NFT is checked too.
//
// Signed in as the owner on a faked account (every body and head is theirs),
// Supabase blocked, no match started.
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-face-slots-test.mjs
//   SHOTS=<dir> also saves the Face screen and the bodies under the pumpkin

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = process.env.SHOTS || "";
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
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
// the tags the game imports these under (one module state per tag)
const tagOf = (file, mod) => fs.readFileSync(path.join(ROOT, file), "utf8").match(new RegExp(`${mod.replace(/[./-]/g, "\\$&")}\\?v=([a-z0-9-]+)`))[1];
const BLOCKY = `/assets/games/troll-ops/characters/blocky-body.js?v=${tagOf("assets/games/troll-ops/menu/lobby.js", "blocky-body.js")}`;
const COSMETICS = `/assets/games/troll-ops/characters/cosmetics.js?v=${tagOf("assets/games/troll-ops/menu/lobby.js", "cosmetics.js")}`;

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.route(/supabase/, (r) => r.abort());
await page.route("https://mayurski-art.github.io/assets/js/troll-accounts.js", (r) => r.fulfill({ path: path.join(ROOT, "assets/js/troll-accounts.js"), contentType: "text/javascript" }));
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript(() => {
  // the owner, signed in on a fake client (no server)
  const user = "troll_runner";
  const fake = {
    async rpc() { return { data: null, error: { message: "offline" } }; },
    from() {
      const q = { select() { return q; }, eq() { return q; }, order() { return q; }, limit() { return q; }, in() { return q; },
        async maybeSingle() { return { data: null, error: null }; }, async upsert() { return { error: null }; },
        then(res) { res({ data: [], error: null }); } };
      return q;
    },
    channel() { const c = { on() { return c; }, subscribe() { return c; }, send() {}, unsubscribe() {}, track() {} }; return c; },
    removeChannel() {},
  };
  let real;
  Object.defineProperty(window, "TrollrunnerAccounts", {
    configurable: true,
    get() { return real && Object.assign(real, { getClient: () => fake, getSession: async () => null, getCachedProfile: () => ({ id: user, username: user }) }); },
    set(v) { real = v; },
  });
});
await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1&season=off`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__toBo2?.fn && !!window.__trollOps?.charInspector, null, { timeout: 180000 });
await page.evaluate(() => window.dispatchEvent(new CustomEvent("trollrunner:auth-changed")));
await sleep(1500);

const click = (sel) => page.evaluate((sel) => document.querySelector(`#to-cos-body ${sel}`).click(), sel);
const screen = () => page.evaluate(() => {
  const m = window.__toBo2.menu;
  return { id: m.current(), rows: [...document.querySelectorAll(".tr-menu-item")].map((r) => ({ id: r.dataset.id, text: r.textContent.replace(/\s+/g, " ").trim(), off: r.classList.contains("is-disabled") || r.getAttribute("aria-disabled") === "true" })) };
});
const go = (ids) => page.evaluate(async (ids) => { const m = window.__toBo2.menu; for (const id of ids) { m.go(id); await new Promise((r) => setTimeout(r, 350)); } }, ids);
const face = () => page.evaluate(() => JSON.parse(localStorage.getItem("trollops:cosmetics") || "{}").face || "");

// ---- the Face screen
await click('[data-body=""]');
await click('[data-expr="grin"]').catch(() => {});
await page.evaluate(() => window.__toBo2.menu.backTo("main"));
await page.click('.to-fn-tab[data-tab="locker"]');
await sleep(800);
await go(["faces"]);
let s = await screen();
const ids = s.rows.map((r) => r.id);
check("the Face screen: Expression, Covering and Head rows", s.id === "faces" && ["expr", "cover", "head"].every((x) => ids.includes(x)), JSON.stringify(s.rows.map((r) => r.text)));
if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "face-1-slots.png") });
await go(["faceCovers"]);
s = await screen();
check("Covering: its own list, the bandanas and None", s.id === "faceCovers" && s.rows.filter((r) => /bandana/i.test(r.text)).length >= 4 && s.rows.some((r) => /^None/.test(r.text)), JSON.stringify(s.rows.map((r) => r.text)));
await page.evaluate(() => window.__toBo2.menu.backTo("faces"));

// a covering and an expression together
await click('[data-cover="bandana-red"]');
await sleep(200);
let f = await face();
check("an expression and a covering are worn together", /:bandana-red/.test(f) && !/pumpkin/.test(f), f);
// the Pumpkin Head over them, then a covering takes it off
await click('[data-head="pumpkin"]');
await sleep(200);
f = await face();
check("the Pumpkin Head goes over them", /:pumpkin$/.test(f), f);
await page.evaluate(() => window.__toBo2.menu.refresh?.());
s = await screen();
const exprRow = s.rows.find((r) => r.id === "expr");
check("under the head, the Expression row says so", /Under the Pumpkin Head/i.test(exprRow?.text || ""), exprRow?.text);
await click('[data-cover="bandana-black"]');
await sleep(200);
f = await face();
check("a covering picked under the head takes the head off", /:bandana-black/.test(f) && !/pumpkin/.test(f), f);
await click('[data-head="pumpkin"]');
await click('[data-expr="grin"]').catch(() => {});
await sleep(200);
f = await face();
check("an expression picked under the head takes it off too", !/pumpkin/.test(f), f);

// ---- the bandana on the 3D trollface (on the Play tab: the stage only
// draws, and poses its rigs, while it's showing)
await page.evaluate(() => window.__toBo2.menu.backTo("main"));
await page.click('.to-fn-tab[data-tab="play"]').catch(() => {});
await sleep(1500);
const shell = await page.evaluate(async () => {
  const h = window.__trollOps.charInspector.humanoid;
  for (let i = 0; i < 60 && !h.parts.head.children.find((o) => o.name === "relief-face"); i++) await new Promise((r) => setTimeout(r, 100));
  await new Promise((r) => setTimeout(r, 500));
  const relief = h.parts.head.children.find((o) => o.name === "relief-face");
  const cov = h.parts.head.userData.covering || [];
  return { relief: !!relief, n: cov.length, onRelief: cov.length > 0 && cov.every((o) => o.parent === relief), face: h.face };
});
check("the bandana lies on the 3D face, not on flat cards", shell.relief && shell.n === 1 && shell.onRelief, JSON.stringify(shell));

// ---- a TROLLS body: Expression and Covering off, Head there
await click('[data-body="trolls-1272"]');
await sleep(400);
await page.click('.to-fn-tab[data-tab="locker"]');
await sleep(800);
await go(["faces"]);
s = await screen();
const off = (id) => s.rows.find((r) => r.id === id)?.off;
check("a TROLLS body: Expression and Covering off, Head still on offer", off("expr") && off("cover") && off("head") === false, JSON.stringify(s.rows));
await click('[data-body=""]');
await page.evaluate(() => window.__toBo2.menu.backTo("main"));
await page.click('.to-fn-tab[data-tab="play"]').catch(() => {});
await sleep(1200);

// ---- every TROLLS body under the Pumpkin Head: nothing sticks out
const bodies = await page.evaluate(async (c) => (await import(c)).BODIES.filter((b) => b.token).map((b) => b.token), COSMETICS);
const out = await page.evaluate(async ([blocky, tokens]) => {
  const THREE = await import("three");
  await import(blocky);
  const ci = window.__trollOps.charInspector;
  const res = [];
  for (const token of tokens) {
    ci.setParty([{ id: "t" + token, face: "grin:og:::pumpkin", body: token }]);
    const m = ci.party[0];
    const h = m.humanoid;
    await (h.blocky?.ready || Promise.resolve());
    for (let i = 0; i < 50 && !h.headwearMesh; i++) await new Promise((r) => setTimeout(r, 100));
    await new Promise((r) => setTimeout(r, 600));   // late pieces (a cap, hair) load and get hidden
    h.root.updateMatrixWorld(true);
    if (!h.headwearMesh) { res.push({ token, pumpkin: false }); continue; }
    const pb = new THREE.Box3().setFromObject(h.headwearMesh);
    const grow = (pb.max.y - pb.min.y) * 0.03;
    const keep = pb.clone().expandByScalar(grow);
    const shown = (o) => { for (let x = o; x; x = x.parent) if (!x.visible) return false; return true; };
    const poke = [];
    const pivot = h.parts.headPivot;
    const onHead = (o) => { for (let x = o; x; x = x.parent) if (x === pivot) return true; return false; };
    const headTop = pb.min.y + (pb.max.y - pb.min.y) * 0.3;
    h.root.traverse((o) => {
      if (!o.isMesh || !shown(o) || o.userData.isHitProxy) return;
      for (let x = o; x; x = x.parent) if (x === h.headwearMesh) return;
      const b = new THREE.Box3().setFromObject(o);
      if (b.isEmpty()) return;
      // a piece of the head (on its pivot, or starting up where the head
      // is: hair, a hat, horns) that shows outside the pumpkin; the
      // shoulders and the neck below it are the body
      if ((onHead(o) || b.min.y > headTop) && !keep.containsBox(b)) poke.push(`${o.name || o.geometry?.type || "mesh"} y${b.min.y.toFixed(2)}..${b.max.y.toFixed(2)}`);
    });
    res.push({ token, pumpkin: true, poke: poke.slice(0, 4) });
  }
  ci.setParty([]);
  return res;
}, [BLOCKY, bodies]);
for (const r of out) check(`TROLLS #${r.token} under the Pumpkin Head: nothing sticks out`, r.pumpkin && !r.poke.length, JSON.stringify(r));
if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "face-2-bodies.png") });

const real = errors.filter((e) => !/supabase|Failed to fetch|NetworkError|ERR_FAILED/i.test(e));
check("no page errors", !real.length, real.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
