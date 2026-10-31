// Troll Forces: the Cigar and the Blunt (TROLLS #1272's own emotes, one
// motion, two props; characters/emotes.js poseLightUp). All in the main
// menu (its emote wheel and the operator, char-inspector.js), so no room is
// ever joined. For each emote: on the wheel with its picture, after the old
// emotes (their wire codes unchanged), hidden from a guest, shown to the
// owner; then on the stick and on #1718, frozen at each beat: in the hand,
// in the grin, the hand on fire, the burning hand under the tip as it
// lights (the tip in the flame), the fire out with the tip still lit, the
// smoke off the tip, and nothing left once it stops.
//
//   NODE_PATH=<checkout>/node_modules node tools/troll-ops-light-up-test.mjs
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
  ".glb": "model/gltf-binary", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".svg": "image/svg+xml", ".gif": "image/gif" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
const ctx = await browser.newContext({ viewport: { width: 1100, height: 700 } });
await ctx.route(/supabase/, (r) => r.abort());   // never a live room
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!window.__trollOps?.charInspector && !!window.__trollOps?.menuEmoteWheel, null, { timeout: 90000 });
await page.waitForTimeout(1500);

// ---- the wheel
const wheel = await page.evaluate(async () => {
  const mod = (file) => import(performance.getEntriesByType("resource").map((e) => e.name).find((n) => n.includes(`/characters/${file}?v=`)));
  const E = await mod("emotes.js");
  const w = window.__trollOps.menuEmoteWheel;
  const ids = E.EMOTES.map((e) => e.id);
  const slot = (id) => ids.indexOf(id);
  const shownFor = () => { w.layout(); return { cigar: w.shown.includes(slot("cigar")), blunt: w.shown.includes(slot("blunt")) }; };
  const guest = shownFor();
  const A = window.TrollrunnerAccounts, keep = A?.getCachedProfile;
  if (A) A.getCachedProfile = () => ({ username: "troll_runner", id: "test" });
  const owner = shownFor();
  if (A) A.getCachedProfile = keep;
  const slice = (id) => w.slices[slot(id)];
  return {
    ids, cigar: slot("cigar"), chug: slot("chug"), blunt: slot("blunt"), guest, owner,
    names: [slice("cigar")?.textContent, slice("blunt")?.textContent],
    icons: [!!slice("cigar")?.querySelector("svg"), !!slice("blunt")?.querySelector("svg")],
    sameIcon: slice("cigar")?.querySelector("svg")?.outerHTML === slice("blunt")?.querySelector("svg")?.outerHTML,
    tokens: [E.EMOTES[slot("cigar")]?.token, E.EMOTES[slot("blunt")]?.token],
  };
});
check("wheel: one Cigar, one Blunt", wheel.ids.filter((i) => i === "cigar").length === 1 && wheel.ids.filter((i) => i === "blunt").length === 1, wheel.ids.join(","));
check("wheel: the cigar keeps its wire code (slot 20), the blunt new at the end", wheel.cigar === 20 && wheel.chug === 21 && wheel.blunt === wheel.ids.length - 1, JSON.stringify([wheel.cigar, wheel.chug, wheel.blunt]));
check("wheel: each named, each with its own picture", /Cigar/.test(wheel.names[0]) && /Blunt/.test(wheel.names[1]) && wheel.icons.every(Boolean) && !wheel.sameIcon, JSON.stringify(wheel.names));
check("wheel: #1272's own (hidden from a guest, shown to the owner)", wheel.tokens.every((t) => t === 1272) && !wheel.guest.cigar && !wheel.guest.blunt && wheel.owner.cigar && wheel.owner.blunt, JSON.stringify(wheel));

// ---- the motion, frozen on each body
for (const kind of ["cigar", "blunt"]) {
  for (const tok of [0, 1718]) {
    const tag = `${kind} on ${tok || "the stick"}`;
    const beats = await page.evaluate(async ({ kind, tok }) => {
      const mod = (file) => import(performance.getEntriesByType("resource").map((e) => e.name).find((n) => n.includes(`/characters/${file}?v=`)));
      const E = await mod("emotes.js"), B = await mod("blocky-body.js");
      const THREE = await import("three");
      const ci = window.__trollOps.charInspector;
      ci.autoSpin = false;
      await B.wearBlocky(ci.humanoid, tok);
      const idx = E.EMOTES.findIndex((e) => e.id === kind), code = E.emoteCode(idx);
      // settle the blend (half a second of play), then freeze at t
      const at = (t) => {
        for (let k = 0; k < 30; k++) { ci.emote = { code, t: Math.max(0, t - 0.5 + k / 60), secs: 1e9 }; ci.tick(1 / 60); }
        ci.emote = { code, t, secs: 1e9 };
        ci.tick(0);
        const rig = ci.humanoid, s = rig.scale;
        rig.root.updateMatrixWorld(true);
        const mouth = rig[kind + "Mouth"], hand = rig[kind + "Hand"], fx = rig[kind + "Fx"];
        const lit = mouth?.visible ? mouth : hand;
        const tip = lit ? lit.localToWorld(new THREE.Vector3(lit.userData.tipX, 0, 0)) : null;
        // the middle of the hand that's showing
        const h = rig.hands.R, shown = h.fist.visible ? h.fist : h.open, box = new THREE.Box3(), piece = new THREE.Box3();
        shown.traverse((o) => {
          if (!o.isMesh || !o.visible || o.material?.side === THREE.BackSide) return;
          if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
          box.union(piece.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld));
        });
        const mitt = box.getCenter(new THREE.Vector3());
        const up = new THREE.Vector3(0, 1, 0).transformDirection(rig.root.matrixWorld);
        const d = tip ? tip.clone().sub(mitt) : new THREE.Vector3();
        const rise = d.dot(up), across = d.addScaledVector(up, -rise).length();
        const c = lit?.userData.tip.material.color;
        const wisps = fx?.userData.wisps.slice(0, 7).filter((w) => w.visible && fx.visible && w.material.opacity > 0.02).length || 0;
        return {
          mouth: !!mouth?.visible, hand: !!hand?.visible,
          fire: fx?.visible ? fx.userData.fire.fire.geo.instanceCount : 0,
          rise: +(rise / s).toFixed(3), across: +(across / s).toFixed(3),
          tip: c ? +c.r.toFixed(2) : 0, wisps,
        };
      };
      const out = { pocket: at(0.7), mouth: at(1.35), burning: at(1.9), lighting: at(2.9), out: at(4.1), held: at(5.8) };
      ci.emote = null;
      for (let k = 0; k < 40; k++) ci.tick(1 / 60);
      const r = ci.humanoid;
      out.gone = !r[kind + "Mouth"]?.visible && !r[kind + "Hand"]?.visible && !r[kind + "Fx"]?.visible;
      return out;
    }, { kind, tok });
    const b = beats;
    check(`${tag}: out of the vest in the hand, no fire`, b.pocket.hand && !b.pocket.mouth && b.pocket.fire === 0, JSON.stringify(b.pocket));
    check(`${tag}: in the grin, the tip cold`, b.mouth.mouth && !b.mouth.hand && b.mouth.fire === 0 && b.mouth.tip < 0.4, JSON.stringify(b.mouth));
    check(`${tag}: the right hand bursts into flame`, b.burning.mouth && b.burning.fire > 5 && b.burning.tip < 0.4, JSON.stringify(b.burning));
    // the tip a flame's height over the middle of the hand, right above it
    check(`${tag}: the burning hand under the tip, the tip in the flame`, b.lighting.fire > 5 && b.lighting.rise > 0.08 && b.lighting.rise < 0.22 && b.lighting.across < 0.04, JSON.stringify(b.lighting));
    check(`${tag}: it lights (the tip glows, smoke curls off it)`, b.lighting.tip > 0.6 && b.lighting.wisps >= 3, JSON.stringify(b.lighting));
    check(`${tag}: the fire out, still lit`, b.out.fire === 0 && b.out.mouth && b.out.tip > 0.6, JSON.stringify(b.out));
    check(`${tag}: out of the grin in the hand, smoking`, b.held.hand && !b.held.mouth && b.held.wisps >= 3, JSON.stringify(b.held));
    check(`${tag}: nothing left once it stops`, b.gone);
  }
}

check("no page errors", errors.length === 0, errors.join(" | "));
await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
