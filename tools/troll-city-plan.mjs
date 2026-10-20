// Troll City's site plan (doc "Troll City redesign in Roblox Studio"): the
// town as the game builds it, straight down, with a metre grid, labels and
// the play bounds; and, from a plan file, what's proposed over it: moves
// (old box -> new box, an arrow), new places (filled), new bounds.
//
//   node tools/troll-city-plan.mjs [--plan tools/troll-city-plan.json] [--out <png>]
//
// Plan file: { bounds: [x0, z0, x1, z1], labels: [[x, z, "text"]],
//   moves: [{ name, from: [x0, z0, x1, z1], to: [x0, z0, x1, z1] }],
//   adds: [{ name, box: [x0, z0, x1, z1] | circle: [x, z, r] }],
//   lines: [[x0, z0, x1, z1, "label"]] (the town's lines: middle, streets) }
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { ROOT, serve } from "./troll-ops-map-capture.mjs";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = require(path.join(process.env.LOCALAPPDATA || "", "npm-cache/_npx/361ceb562f3b3235/node_modules/playwright"))); }
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const PLAN = arg("--plan", null);
const OUT = arg("--out", path.join(ROOT, ".claude/roblox-export/troll-city-plan.png"));
const plan = PLAN ? JSON.parse(fs.readFileSync(PLAN, "utf8")) : {};
const VIEW = plan.view || [-100, -66, 116, 92];     // x0 z0 x1 z1 metres
const PPM = 8;                                     // pixels a metre
const W = (VIEW[2] - VIEW[0]) * PPM, H = (VIEW[3] - VIEW[1]) * PPM;

const server = await serve(0);
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
page.on("pageerror", (e) => console.log("page error:", e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/__export.html`);
const png = await page.evaluate(async ({ VIEW, W, H, PPM, plan }) => {
  const THREE = await import("three");
  const { buildMap, MAPS } = await import("/assets/games/troll-ops/maps/maps.js");
  const built = buildMap("trollcity", { colliders: [], arena: {} });
  await new Promise((r) => {
    const mgr = THREE.DefaultLoadingManager;
    let idle = 0, n = 0;
    const t = setInterval(() => { idle = mgr.itemsLoaded >= mgr.itemsTotal ? idle + 1 : 0; if (idle > 6 || ++n > 80) { clearInterval(t); r(); } }, 250);
  });
  const map = MAPS.trollcity;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xc8a272);
  scene.add(built.root, new THREE.HemisphereLight(map.hemi.sky, map.hemi.ground, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 2.4); sun.position.set(-30, 80, 20); scene.add(sun);
  built.root.traverse((o) => { if (o.isMesh && o.material?.name === "hill") o.visible = false; });
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  r.setSize(W, H); r.setPixelRatio(1); r.outputColorSpace = THREE.SRGBColorSpace;
  const cam = new THREE.OrthographicCamera(VIEW[0], VIEW[2], -VIEW[1], -VIEW[3], 1, 400);
  cam.position.set(0, 200, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0);
  // (looking down with -z up the image: x right, z down, so world (x, z) is pixel ((x - x0) ppm, (z - z0) ppm))
  r.render(scene, cam);
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d");
  g.drawImage(r.domElement, 0, 0);
  const P = (x, z) => [(x - VIEW[0]) * PPM, (z - VIEW[1]) * PPM];
  // the grid
  g.lineWidth = 1;
  g.font = "bold 13px sans-serif";
  for (let x = Math.ceil(VIEW[0] / 10) * 10; x <= VIEW[2]; x += 10) {
    const [px] = P(x, 0);
    g.strokeStyle = x % 50 === 0 ? "rgba(0,0,0,0.45)" : "rgba(0,0,0,0.13)";
    g.beginPath(); g.moveTo(px, 0); g.lineTo(px, H); g.stroke();
    g.fillStyle = "rgba(0,0,0,0.7)"; g.fillText(String(x), px + 3, 14);
  }
  for (let z = Math.ceil(VIEW[1] / 10) * 10; z <= VIEW[3]; z += 10) {
    const [, pz] = P(0, z);
    g.strokeStyle = z % 50 === 0 ? "rgba(0,0,0,0.45)" : "rgba(0,0,0,0.13)";
    g.beginPath(); g.moveTo(0, pz); g.lineTo(W, pz); g.stroke();
    g.fillStyle = "rgba(0,0,0,0.7)"; g.fillText(String(z), 3, pz - 3);
  }
  const box = (b, stroke, fill, dash = []) => {
    const [x0, z0] = P(b[0], b[1]), [x1, z1] = P(b[2], b[3]);
    g.setLineDash(dash); g.lineWidth = 3; g.strokeStyle = stroke;
    if (fill) { g.fillStyle = fill; g.fillRect(x0, z0, x1 - x0, z1 - z0); }
    g.strokeRect(x0, z0, x1 - x0, z1 - z0); g.setLineDash([]);
  };
  const label = (x, z, t, col = "#111", bg = "rgba(255,248,230,0.85)") => {
    const [px, pz] = P(x, z);
    g.font = "bold 15px sans-serif";
    const lines = t.split("\n"), w = Math.max(...lines.map((l) => g.measureText(l).width)) + 10, h = lines.length * 17 + 5;
    g.fillStyle = bg; g.fillRect(px - w / 2, pz - h / 2, w, h);
    g.fillStyle = col; g.textAlign = "center";
    lines.forEach((l, i) => g.fillText(l, px, pz - h / 2 + 16 + i * 17));
    g.textAlign = "left";
  };
  // today's play bounds
  const B = map.bounds;
  box([B.minX, B.minZ, B.maxX, B.maxZ], "rgba(30,30,30,0.9)", null, [10, 6]);
  if (plan.bounds) box(plan.bounds, "#c0182a", null, [16, 8]);
  for (const a of plan.adds || []) {
    if (a.circle) { const [px, pz] = P(a.circle[0], a.circle[1]); g.fillStyle = "rgba(40,120,255,0.35)"; g.strokeStyle = "#1d5fd0"; g.lineWidth = 3; g.beginPath(); g.arc(px, pz, a.circle[2] * PPM, 0, Math.PI * 2); g.fill(); g.stroke(); label(a.circle[0], a.circle[1], a.name, "#0b2f70"); }
    else { box(a.box, "#1d5fd0", "rgba(40,120,255,0.28)"); label((a.box[0] + a.box[2]) / 2, (a.box[1] + a.box[3]) / 2, a.name, "#0b2f70"); }
  }
  for (const m of plan.moves || []) {
    box(m.from, "rgba(200,30,40,0.9)", "rgba(200,30,40,0.12)", [6, 5]);
    box(m.to, "#c0182a", "rgba(255,90,60,0.32)");
    const [ax, az] = P((m.from[0] + m.from[2]) / 2, (m.from[1] + m.from[3]) / 2), [bx, bz] = P((m.to[0] + m.to[2]) / 2, (m.to[1] + m.to[3]) / 2);
    g.strokeStyle = "#c0182a"; g.lineWidth = 3; g.beginPath(); g.moveTo(ax, az); g.lineTo(bx, bz); g.stroke();
    const a = Math.atan2(bz - az, bx - ax);
    g.fillStyle = "#c0182a"; g.beginPath(); g.moveTo(bx, bz); g.lineTo(bx - 14 * Math.cos(a - 0.4), bz - 14 * Math.sin(a - 0.4)); g.lineTo(bx - 14 * Math.cos(a + 0.4), bz - 14 * Math.sin(a + 0.4)); g.fill();
    label((m.to[0] + m.to[2]) / 2, (m.to[1] + m.to[3]) / 2, m.name, "#6a0010");
  }
  for (const [x0, z0, x1, z1, t] of plan.lines || []) {
    const [a, b] = P(x0, z0), [c, d] = P(x1, z1);
    g.setLineDash([14, 7]); g.lineWidth = 2; g.strokeStyle = "#0a7a3c";
    g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); g.setLineDash([]);
    if (t) label(x1 - (x1 - x0) * 0.04, z1 - (z1 - z0) * 0.04, t, "#0a5a2c");
  }
  for (const [x, z, t] of plan.labels || []) label(x, z, t);
  // compass
  g.fillStyle = "#111"; g.font = "bold 22px sans-serif"; g.fillText("N ↑", W - 60, 34);
  return c.toDataURL("image/png");
}, { VIEW, W, H, PPM, plan });
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, Buffer.from(png.split(",")[1], "base64"));
console.log(`wrote ${OUT} (${W}x${H})`);
await browser.close();
server.close();
