// Troll Forces: talking to NPCs (modes/npc-dialogue.js, modes/talk/north.js;
// docs/NPC-DIALOGUE.md). Supabase blocked (never a live room).
//   Kabukigrin Socialize, at the bar: looking at North gives "Talk to North",
//   looking away or at Pourtia (who doesn't talk) gives nothing; hold X opens
//   it: the view eases onto his face, the lens narrows, the feet stop; the
//   first-time greeting; keys move and pick; a topic and back; five rumours
//   with no repeats, then the dry line, then round again; the bar's door
//   says its fallback, and a registered service's options work; the pad's
//   A picks and B says goodbye (not the A held when it opened); Esc says
//   goodbye, the lens comes back, no pause menu; next time he's met you.
//   Screenshots: desktop 1280x720, phones 812x375 and 667x375 (Trollnite is
//   landscape only: upright, the game shows its turn-sideways card), with every
//   option's box measured (inside the screen, no two overlapping, clear of
//   the line).
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-npc-dialogue-test.mjs [outDir]

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.argv[2] || path.join(ROOT, "..", "npc-dialogue-shots");
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".svg": "image/svg+xml", ".gif": "image/gif" };
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
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// the dialogue module as the game loads it (the same ?v= tag: one instance)
const G = path.join(ROOT, "assets/games/troll-ops");
const ND = `/assets/games/troll-ops/modes/npc-dialogue.js?v=${fs.readFileSync(path.join(G, "view/player-update.js"), "utf8").match(/npc-dialogue\.js\?v=([^"]+)"/)[1]}`;

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
async function open(opts) {
  const ctx = await browser.newContext(opts);
  await ctx.route(/supabase/, (r) => r.abort());
  const page = await ctx.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 240000 });
  await page.waitForFunction(() => !!window.__trollOps && !!window.__trollTalk, null, { timeout: 240000 });
  await page.evaluate(async () => {
    const T = window.__trollOps;
    T.setMode("social"); T.loadout.mapId = "kabukigrin";
    await T.startGame(); if (T.isStaging?.()) T.endStaging();
    T.player.maxHp = T.player.hp = 1e9;
    window.__trollTalk.resetFlags();
  });
  await wait(+(process.env.SETTLE || 15000));
  await findBar(page);
  // out of the line (it can join late on a slow load: leave until it stays
  // left a second), a wristband on
  await page.evaluate(async () => {
    const C = window.__trollClub;
    if (!C) return;
    for (let calm = 0, i = 0; calm < 4 && i < 120; i++) {
      if (C.club.phase !== "none") { C.leave(); calm = 0; } else calm++;
      await new Promise((r) => setTimeout(r, 250));
    }
    C.band(); C.club.band = C.BAND.guest;
  });
  return page;
}
// stand at (x, z) on the club floor looking along yaw, eye level
const stand = (page, x, z, yaw, pitch = -0.05) => page.evaluate(async ([x, y, z, yaw, pitch]) => {
  const T = window.__trollOps;
  T.keys.clear();
  T.move.pos.set(x, y, z); T.move.velocity?.set(0, 0, 0);
  T.look.yaw = yaw; T.look.pitch = pitch;
  await new Promise((r) => setTimeout(r, 400));
  T.look.yaw = yaw; T.look.pitch = pitch;
  await new Promise((r) => setTimeout(r, 150));
}, [x, FLOOR, z, yaw, pitch]);
const state = (page) => page.evaluate(() => window.__trollTalk.state());
const key = async (page, code, ms = 60) => { await page.keyboard.down(code); await wait(ms); await page.keyboard.up(code); await wait(80); };
// pick option `k` once the line has finished typing
async function pick(page, k) {
  await page.evaluate(() => window.__trollTalk.finish());
  await key(page, `Digit${k + 1}`);
  await page.evaluate(() => window.__trollTalk.finish());
  return state(page);
}
const until = (page, fn, ms = 10000) => page.waitForFunction(fn, null, { timeout: ms, polling: 50 }).then(() => true, () => false);
const optIndex = (s, text) => s.opts.findIndex((t) => t === text);
// where the bar is comes from the cast (maps/kabukigrin-social.js): North,
// Pourtia beside him, and a spot 2.3 m out in front of him across the counter
let NORTH, POURTIA, AT_BAR, FLOOR = 0;
async function findBar(page) {
  // (a busy machine can take a while to spawn the crowd)
  await page.waitForFunction(() => window.__trollOps.townNpcs()?.list.some((x) => x.c.talk === "north"), null, { timeout: 120000, polling: 250 });
  const c = await page.evaluate(() => {
    const L = window.__trollOps.townNpcs().list;
    const at = (n) => ({ x: n.x, z: n.z, y: n.c.y ?? 0, yaw: n.yaw });
    return { n: at(L.find((x) => x.c.talk === "north")), p: at(L.find((x) => x.c.name === "Pourtia")) };
  });
  NORTH = c.n; POURTIA = c.p; FLOOR = c.n.y;
  const fx = -Math.sin(c.n.yaw), fz = -Math.cos(c.n.yaw);   // the way he faces
  AT_BAR = { x: c.n.x + fx * 2.3, z: c.n.z + fz * 2.3, yaw: c.n.yaw + Math.PI };
}
// across from Pourtia: the same distance out, level with her
const atPourtia = () => ({ x: POURTIA.x + (AT_BAR.x - NORTH.x), z: POURTIA.z + (AT_BAR.z - NORTH.z) });

/* Every option row inside the screen, none overlapping another or the line. */
const measure = (page) => page.evaluate(async () => {
  // the ?tohooks debug readout isn't in the real game: out of the way
  for (const el of document.querySelectorAll("body *")) {
    if (el.children.length === 0 && /^s*markingStreak:/m.test(el.textContent)) {
      let p = el;
      while (p && p !== document.body && !["fixed", "absolute"].includes(getComputedStyle(p).position)) p = p.parentElement;
      if (p && p !== document.body) p.style.display = "none";
    }
  }
  const r = (el) => el.getBoundingClientRect();
  // nothing else drawn over the line or a row: hit-test their corners and middle
  const covered = [...document.querySelectorAll(".to-talk-opt, .to-talk-line")].filter((el) => {
    const b = r(el);
    return [[b.left + 4, b.top + 4], [b.right - 4, b.top + 4], [b.left + 4, b.bottom - 4], [b.right - 4, b.bottom - 4], [(b.left + b.right) / 2, (b.top + b.bottom) / 2]]
      .some(([x, y]) => { const h = document.elementFromPoint(x, y); return h && !h.closest(".to-talk"); });
  }).length;
  // where North's face is on screen, and whether the panel's over it
  const T = window.__trollOps, n = T.townNpcs().list.find((x) => x.c.talk === "north");
  const hp = n.rig.parts.head.getWorldPosition(T.camera.position.clone()).project(T.camera);
  const face = { x: (hp.x + 1) / 2 * innerWidth, y: (1 - hp.y) / 2 * innerHeight };
  const pb = r(document.querySelector(".to-talk-panel"));
  const lineTop = r(document.querySelector(".to-talk-who")).top;
  const faceClear = face.x > 0 && face.x < innerWidth && face.y > 0 && (pb.left > innerWidth * 0.25 ? face.x < pb.left - 20 : face.y < lineTop - 20);
  const W = innerWidth, H = innerHeight;
  const rows = [...document.querySelectorAll(".to-talk-opt")].map(r);
  const line = r(document.querySelector(".to-talk-line"));
  const who = r(document.querySelector(".to-talk-who"));
  const hit = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
  const out = rows.filter((b) => b.left < -0.5 || b.top < -0.5 || b.right > W + 0.5 || b.bottom > H + 0.5).length;
  let overlap = 0;
  for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) if (hit(rows[i], rows[j])) overlap++;
  const onLine = rows.filter((b) => hit(b, line) || hit(b, who)).length;
  const touch = document.getElementById("to-touch");
  const touchShown = !!touch && getComputedStyle(touch).display !== "none" && !touch.hidden;
  // text clipped inside a row (scroll wider than the box)
  const clipped = [...document.querySelectorAll(".to-talk-opt .to-talk-t")].filter((t) => t.scrollWidth > t.clientWidth + 1 || t.getBoundingClientRect().right > t.closest(".to-talk-opt").getBoundingClientRect().right + 0.5).length;
  return { n: rows.length, out, overlap, onLine, covered, faceClear, face: [Math.round(face.x), Math.round(face.y)], touchShown, clipped, minH: Math.min(...rows.map((b) => b.height)), W, H };
});

/* ---- desktop */
{
  const page = await open({ viewport: { width: 1280, height: 720 } });
  await stand(page, AT_BAR.x, AT_BAR.z, AT_BAR.yaw);
  const pr = await page.evaluate(() => ({ p: window.__trollTalk.prompt(), label: document.getElementById("to-pickup-prompt")?.textContent || "" }));
  check("looking at North: Talk to North", pr.p?.name === "North" && /Talk to North/.test(pr.label), JSON.stringify(pr));
  await stand(page, AT_BAR.x, AT_BAR.z, AT_BAR.yaw + Math.PI);
  check("looking away: no prompt", !(await page.evaluate(() => window.__trollTalk.prompt())));
  await stand(page, atPourtia().x, atPourtia().z, AT_BAR.yaw);
  check("looking at Pourtia (doesn't talk): no prompt", !(await page.evaluate(() => window.__trollTalk.prompt())));

  // hold X
  // a little off his face, so the ease has somewhere to go (inside the prompt's cone)
  const SIDE = { x: AT_BAR.x, z: AT_BAR.z + 1.1 };
  const toHim = Math.atan2(-(NORTH.x - SIDE.x), -(NORTH.z - SIDE.z));
  await stand(page, SIDE.x, SIDE.z, toHim + 0.15, 0.05);
  const pre = await page.evaluate(() => window.__trollTalk.prompt());
  check("a little off his face: still the prompt", pre?.name === "North", JSON.stringify(pre));
  await page.keyboard.down("KeyX");
  await until(page, () => !!window.__trollTalk.state());
  await page.keyboard.up("KeyX");
  await until(page, () => window.__trollTalk.state()?.ease >= 1);
  let s = await state(page);
  check("hold X opens the talk", s?.npc === "north", JSON.stringify(s));
  if (!s) { await page.evaluate(() => window.__trollTalk.open()); await wait(700); s = await state(page); }
  check("first time: the new-face greeting", /New face/.test(s?.line || ""), s?.line);
  check("five options at the hub", s?.opts.length === 5, s?.opts.join(" / "));
  const view = await page.evaluate(() => {
    const T = window.__trollOps;
    const n = T.townNpcs().list.find((x) => x.c.talk === "north");
    const h = n.rig.parts.head.getWorldPosition(T.camera.position.clone());
    const e = T.camera.position;
    const want = Math.atan2(-(h.x - e.x), -(h.z - e.z));
    return { dyaw: Math.abs(Math.atan2(Math.sin(T.look.yaw - want), Math.cos(T.look.yaw - want))), zoom: T.camera.zoom,
      head: +n.rig.parts.headPivot.rotation.y.toFixed(2) };
  });
  check("the view eased onto his face", view.dyaw < 0.03, `off by ${view.dyaw.toFixed(3)} rad`);
  check("the lens narrowed", Math.abs(view.zoom - 1.12) < 0.01, `zoom ${view.zoom}`);
  check("his head turned to us", Math.abs(view.head) > 0.05, `head yaw ${view.head}`);
  const p0 = await page.evaluate(() => window.__trollOps.move.pos.clone());
  await page.keyboard.down("KeyW"); await wait(600); await page.keyboard.up("KeyW");
  const moved = await page.evaluate((p0) => Math.hypot(window.__trollOps.move.pos.x - p0.x, window.__trollOps.move.pos.z - p0.z), p0);
  check("the feet stay put while talking (W)", moved < 0.05, `moved ${moved.toFixed(3)} m`);
  s = await state(page);
  check("W moved the highlight instead", s.sel !== 0, `sel ${s.sel}`);

  // desktop shot + measure
  await page.evaluate(() => window.__trollTalk.finish());
  await wait(300);
  await page.screenshot({ path: path.join(OUT, "north-desktop-1280x720.png") });
  let m = await measure(page);
  check("desktop: options inside the screen, none overlapping or covered, clear of the line, his face in the clear", m.n === 5 && !m.out && !m.overlap && !m.onLine && !m.clipped && !m.covered && m.faceClear, JSON.stringify(m));

  // a topic and back
  s = await pick(page, optIndex(s, "Who are you?"));
  check("Who are you?", /North\. I point drinks/.test(s.line) && s.opts.includes("Why North?"), s.line);
  s = await pick(page, optIndex(s, "Why North?"));
  check("a sub-topic answers and stays in the topic", /lost a tab/.test(s.line) && s.opts.includes("Back to it."), s.line);
  s = await pick(page, optIndex(s, "Back to it."));
  check("Back to it. -> the hub", s.node === "main" && s.opts.length === 5, s.node);
  // the lore branch, a VIP-only line hidden without the band
  s = await pick(page, optIndex(s, "What is this place?"));
  check("lore: the place", /Kabukigrin/.test(s.line) && !s.opts.includes("VIP's nice."), s.opts.join(" / "));
  s = await pick(page, optIndex(s, "Back to it."));

  // rumours: five, no repeats, then the dry line, then round again
  const heard = [];
  for (let i = 0; i < 5; i++) { s = await pick(page, optIndex(s, "Heard anything?")); heard.push(s.line); }
  check("five rumours, no repeats", new Set(heard).size === 5, heard.map((l) => l.slice(0, 18)).join(" | "));
  s = await pick(page, optIndex(s, "Heard anything?"));
  check("then the dry line", /That's all I've got/.test(s.line), s.line);
  s = await pick(page, optIndex(s, "Heard anything?"));
  check("then round again", heard.includes(s.line), s.line);

  // the bar's door: the fallback, then a registered service's options
  s = await pick(page, optIndex(s, "What'll it be?"));
  check("What'll it be? with no bar service: the fallback line, back at the hub", /Taps are getting rewired/.test(s.line) && s.node === "main", s.line);
  await page.evaluate(async (ND) => {
    const m = await import(ND);
    window.__served = [];
    m.registerTalkService("bar", () => ({ say: "Name your poison.", options: [{ text: "Sake", run: () => { window.__served.push("sake"); return "Sake. Classy."; } }] }));
  }, ND);
  s = await pick(page, optIndex(s, "What'll it be?"));
  check("with a bar service: its options plus Never mind", s.line === "Name your poison." && s.opts.join() === "Sake,Actually, nothing.", s.opts.join(" / "));
  s = await pick(page, 0);
  const served = await page.evaluate(() => window.__served);
  check("picking one runs it and North answers", served.join() === "sake" && s.line === "Sake. Classy." && s.node === "main", `${served} · ${s.line}`);

  // the pad: A held from before isn't an answer; then A picks, B says goodbye
  await page.evaluate(() => {
    const pad = { index: 0, connected: true, id: "test pad", mapping: "standard", axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    window.__pad = pad;
    navigator.getGamepads = () => [pad];
    pad.buttons[0].pressed = true;   // A down already
  });
  await wait(300);
  const sel0 = (await state(page)).node;
  check("an A already down isn't an answer", sel0 === "main");
  await page.evaluate(() => { window.__pad.buttons[0].pressed = false; window.__trollTalk.finish(); });
  await wait(200);
  await page.evaluate(() => { window.__pad.buttons[13].pressed = true; });   // d-pad down
  await wait(150);
  await page.evaluate(() => { window.__pad.buttons[13].pressed = false; });
  await wait(150);
  s = await state(page);
  check("d-pad down moves the highlight", s.sel === 1, `sel ${s.sel}`);
  await page.evaluate(() => { window.__pad.buttons[0].pressed = true; });
  await wait(150);
  await page.evaluate(() => { window.__pad.buttons[0].pressed = false; });
  await wait(150);
  s = await state(page);
  check("A picks the highlighted option", /North\. I point drinks/.test(s.line), s.line);
  await page.evaluate(() => { window.__pad.buttons[1].pressed = true; });
  await wait(150);
  await page.evaluate(() => { window.__pad.buttons[1].pressed = false; navigator.getGamepads = () => []; });
  s = await state(page);
  check("B says goodbye", /Tip your bartender|Mind the step/.test(s?.line || "") && s.opts.length === 0, s?.line);
  await until(page, () => !window.__trollTalk.state() && Math.abs(window.__trollOps.camera.zoom - 1) < 1e-3);
  const shut = await page.evaluate(async () => ({ s: window.__trollTalk.state(), zoom: window.__trollOps.camera.zoom, pause: !document.getElementById("to-pause")?.hidden,
    paused: (await import("/assets/games/troll-ops/core/state.js?v=st1")).game.localPauseOnly }));
  check("then it closes, the lens back to normal", !shut.s && Math.abs(shut.zoom - 1) < 1e-3, JSON.stringify(shut));
  check("feet back, no pause menu", shut.paused === false && !shut.pause, JSON.stringify(shut));

  // next time: he's met you; Esc says goodbye
  await stand(page, AT_BAR.x, AT_BAR.z, AT_BAR.yaw);
  await page.evaluate(() => window.__trollTalk.open());
  await wait(300);
  s = await state(page);
  check("next time: a met greeting", /Back already|You again/.test(s?.line || ""), s?.line);
  check("flags kept in this browser", await page.evaluate(() => { try { return !!JSON.parse(localStorage.getItem("trollops:talk")).north.met; } catch { return false; } }));
  await page.evaluate(() => window.__trollTalk.finish());
  await key(page, "Escape");
  await page.evaluate(() => window.__trollTalk.finish());
  await until(page, () => !window.__trollTalk.state());
  check("Esc says goodbye and closes", !(await state(page)) && await page.evaluate(() => document.getElementById("to-pause")?.hidden !== false));
  await page.evaluate(() => { window.__trollTalk.resetFlags(); window.__trollTalk.open(); });
  await wait(900);
  check("no page errors", page.errors.length === 0, page.errors.slice(0, 3).join(" | "));
  await page.context().close();
}

/* ---- phones, landscape */
for (const [w, h, name] of [[812, 375, "812x375"], [667, 375, "667x375"]]) {
  const page = await open({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await stand(page, AT_BAR.x, AT_BAR.z, AT_BAR.yaw);
  const ok = await page.evaluate(() => window.__trollTalk.open());
  if (!ok) {
    const why = await page.evaluate(() => {
      const T = window.__trollOps, n = T.townNpcs().list.find((x) => x.c.talk === "north");
      const p = T.move.pos;
      return { pos: [p.x, p.y, p.z].map((v) => +v.toFixed(2)), north: [n.x, n.c.y, n.z], seen: n.rig.root.visible, yaw: +T.look.yaw.toFixed(2),
        club: window.__trollClub?.club.phase, cam: [T.camera.position.x, T.camera.position.y, T.camera.position.z].map((v) => +v.toFixed(2)) };
    });
    check(`phone ${name}: opens`, false, JSON.stringify(why));
    await page.context().close();
    continue;
  }
  await wait(800);
  await page.evaluate(() => window.__trollTalk.finish());
  await wait(200);
  await page.screenshot({ path: path.join(OUT, `north-phone-${w}x${h}.png`) });
  const m = await measure(page);
  check(`phone ${name}: opens`, ok);
  check(`phone ${name}: options inside the screen, none overlapping, clear of the line`, m.n === 5 && !m.out && !m.overlap && !m.onLine && !m.clipped && !m.covered && m.faceClear, JSON.stringify(m));
  check(`phone ${name}: the touch controls step aside`, !m.touchShown);
  check(`phone ${name}: rows big enough to tap (>= 40 px)`, m.minH >= 40, `min ${m.minH}`);
  // a tap picks
  const t = await page.evaluate(() => [...document.querySelectorAll(".to-talk-opt")].find((b) => /Who are you/i.test(b.textContent)).getBoundingClientRect());
  await page.touchscreen.tap(t.left + t.width / 2, t.top + t.height / 2);
  await wait(200);
  const s = await state(page);
  check(`phone ${name}: a tap picks`, /North\. I point drinks/.test(s?.line || ""), s?.line);
  await page.evaluate(() => window.__trollTalk.finish());
  await wait(200);
  await page.screenshot({ path: path.join(OUT, `north-phone-${w}x${h}-who.png`) });
  const m2 = await measure(page);
  check(`phone ${name}: the topic's options fit too`, !m2.out && !m2.overlap && !m2.onLine && !m2.clipped && !m2.covered && m2.faceClear, JSON.stringify(m2));
  check(`phone ${name}: no page errors`, page.errors.length === 0, page.errors.slice(0, 3).join(" | "));
  await page.context().close();
}

await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nall passed");
console.log(`shots: ${OUT}`);
process.exit(failures ? 1 : 0);
