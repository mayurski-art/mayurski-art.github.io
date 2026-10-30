// Troll Warfare: two squads joined up (menu/invites.js squads; lobby.js the
// stage's arrows). Supabase is blocked and the presence channel is offline,
// so the other squad is faked (window.__toInvites.fakeSquad, as if its
// leader had said yes); nothing presses a go button.
//   1. Alone: your squad's name under the pads ("Your squad"), no arrows;
//      the pencil renames it (the leader's), the name kept (synced key).
//   2. We asked, they said yes (2 of them): the arrows, "Your squad",
//      Together picked, both buttons ours to press; the stage still us.
//   3. The next arrow: their squad on the pads (their names, their leader
//      tagged, no "+", our operator hidden); back again: us.
//   4. Together: a started match sends their leader to our side; Versus:
//      the other side. We ask for the first side (net.js preferTeam), and
//      chooseTeam takes it.
//   5. The other leader's view (they asked us): Together / Versus shown,
//      not ours to press.
//   6. The arrows clear the lobby's controls, desktop, sideways, upright.
//   7. Splitting the squads (Split, under the pads): the arrows go.
//   8. Not on the Locker.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-squads-test.mjs
//   (ANGLE=swiftshader without a GPU)
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = path.join(ROOT, ".claude/run");
fs.mkdirSync(SHOTS, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg", ".mp4": "video/mp4", ".webm": "video/webm" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const browser = await chromium.launch({ args: [`--use-angle=${process.env.ANGLE || "d3d11"}`, "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });

let fails = 0;
const check = (ok, what, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${what}${extra ? "  " + extra : ""}`); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
const THEIRS = [{ viewer: "v-grin", name: "grinlord", look: null }, { viewer: "v-kek", name: "kekw", look: null }];

async function open(w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await ctx.route(/supabase/, (r) => r.abort());
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__trollOps && !!window.__toBo2?.fn && !!window.__toInvites, null, { timeout: 180000 });
  await page.evaluate(() => { window.__toBo2.menu.backTo("main"); document.body.classList.add("tf-anim-off"); });
  await sleep(1200);
  return { ctx, page };
}
const nav = (page) => page.evaluate(() => {
  const n = document.querySelector(".to-squad-nav");
  const tags = [...document.querySelectorAll(".to-stage-tag")].filter((t) => !t.hidden).map((t) => t.querySelector("b").textContent);
  return {
    shown: !!n && !n.hidden && n.getBoundingClientRect().width > 0,
    arrows: [...(n?.querySelectorAll(".to-squad-arrow") || [])].filter((a) => a.offsetParent).length,
    name: n?.querySelector(".to-squad-name")?.textContent,
    on: n?.querySelector("[data-mode].is-on")?.dataset.mode,
    canPick: [...(n?.querySelectorAll("[data-mode]") || [])].every((b) => !b.disabled),
    tags, adds: [...document.querySelectorAll(".to-stage-add")].filter((b) => !b.hidden).length,
    meShown: window.__trollOps.charInspector?.humanoid?.root?.visible,
  };
});

// ---- 1, 2
let { ctx, page } = await open(1280, 720);
let n = await nav(page);
check(n.shown && n.arrows === 0 && n.name === "Your squad", "alone: Your squad under the pads, no arrows", JSON.stringify(n));
await page.click(".to-squad-pen");
await page.fill(".to-squad-edit", "  The Grinners  ");
await page.press(".to-squad-edit", "Enter");
await sleep(300);
n = await nav(page);
const kept = await page.evaluate(() => localStorage.getItem("trollops:squad-name"));
check(n.name === "The Grinners" && kept === "The Grinners", "the leader renames the squad (trimmed, kept)", `${n.name} / ${kept}`);
await page.evaluate((t) => window.__toInvites.fakeSquad(t), THEIRS);
await sleep(400);
n = await nav(page);
check(n.shown && n.arrows === 2 && n.name === "The Grinners" && n.on === "together" && n.canPick, "joined up (we asked): the arrows, our name, Together, ours to pick", JSON.stringify(n));
check(n.tags[0] === "Guest troll" && n.meShown === true, "the stage is still us", JSON.stringify(n.tags));

// ---- 3
await page.click(".to-squad-arrow.is-next");
await sleep(400);
n = await nav(page);
check(n.name === "grinlord's squad" && n.tags.join() === "grinlord,kekw" && n.adds === 0 && n.meShown === false, "the next arrow: their squad on the pads, no +, ours hidden", JSON.stringify(n));
const leaderTag = await page.evaluate(() => document.querySelector('.to-stage-tag[data-slot="0"] small')?.textContent);
check(leaderTag === "Squad leader", "their leader tagged", leaderTag);
await page.screenshot({ path: path.join(SHOTS, "squads-theirs.png") });
await page.click(".to-squad-arrow.is-prev");
await sleep(400);
n = await nav(page);
check(n.name === "The Grinners" && n.tags[0] === "Guest troll" && n.meShown === true, "and back: us", JSON.stringify(n));

// ---- 4
let go = await page.evaluate(() => window.__toInvites.goFor());
const lead = (g) => g.go.find((m) => m.to === "v-grin");
check(lead(go)?.team === "phantom" && go.mine === "phantom", "Together: their leader comes to our side", JSON.stringify(go));
await page.click('.to-squad-mode [data-mode="versus"]');
await sleep(300);
go = await page.evaluate(() => window.__toInvites.goFor());
check((await nav(page)).on === "versus" && lead(go)?.team === "ghost" && go.mine === "phantom", "Versus: their leader goes to the other side", JSON.stringify(go));
await sleep(1200);   // (partyTick, each second, puts our side on the net)
const team = await page.evaluate(() => { const net = window.__trollOps.net; const want = net.preferTeam; const got = net.chooseTeam(); return { want, got }; });
check(team.want === "phantom" && team.got === "phantom", "we ask for our side, and chooseTeam takes it", JSON.stringify(team));
await page.screenshot({ path: path.join(SHOTS, "squads-desktop.png") });

// ---- 7
await page.click(".to-squad-split");
await sleep(400);
n = await nav(page);
check(n.shown && n.arrows === 0 && n.name === "The Grinners", "Split: the arrows go, our name stays", JSON.stringify(n));
// ---- 8
await page.click('.to-fn-tab[data-tab="locker"]');
await sleep(800);
check(!(await nav(page)).shown, "not on the Locker");
await ctx.close();

// ---- 5
({ ctx, page } = await open(1280, 720));
await page.evaluate((t) => window.__toInvites.fakeSquad(t, { lead: false }), THEIRS);
await sleep(400);
n = await nav(page);
const split = await page.evaluate(() => !!document.querySelector(".to-squad-split")?.offsetParent);
check(n.shown && n.on === "together" && !n.canPick && split, "the other leader: Together shown, not theirs to pick; Split theirs", JSON.stringify(n));
go = await page.evaluate(() => window.__toInvites.goFor());
check(!go.go.some((m) => m.to === "v-grin"), "and it doesn't send the one who asked anywhere (they start)", JSON.stringify(go));
await ctx.close();

// ---- 6
const CONTROLS = ".to-fn-top > *, .to-fn-left > *, .to-fn-play, .to-fn-allmodes, .to-bo2-foot .to-bo2-online, .to-bo2-foot .to-char-emote, .to-bo2-foot .to-bo2-chat, .to-bo2-party, .to-radio-toggle";
for (const [label, w, h] of [["desktop", 1280, 720], ["sideways", 844, 390], ["upright", 390, 844]]) {
  ({ ctx, page } = await open(w, h));
  await page.evaluate((t) => window.__toInvites.fakeSquad(t), THEIRS);
  await sleep(500);
  const bad = await page.evaluate((sel) => {
    const vis = (e) => e.offsetParent && getComputedStyle(e).visibility !== "hidden";
    const r = (e) => e.getBoundingClientRect();
    const mine = [...document.querySelectorAll(".to-squad-nav > *")].filter(vis).map(r);
    const out = [];
    for (const c of [...document.querySelectorAll(sel)].filter(vis)) {
      const b = r(c);
      for (const a of mine) if (a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1) out.push(c.className.toString().split(" ").pop());
    }
    for (const a of mine) if (a.left < 0 || a.right > innerWidth || a.bottom > innerHeight) out.push("off screen");
    return [mine.length, out];
  }, CONTROLS);
  check(bad[0] === 3 && !bad[1].length, `${label}: the arrows clear the lobby's controls`, JSON.stringify(bad));
  await page.screenshot({ path: path.join(SHOTS, `squads-${label}.png`) });
  await ctx.close();
}

check(!errors.length, "no page errors", errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
console.log(fails ? `${fails} FAILED` : "ALL PASS");
process.exit(fails ? 1 : 0);
