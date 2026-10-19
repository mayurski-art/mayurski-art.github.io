// Troll City's contract (doc "Troll City redesign in Roblox Studio"): the
// Studio town must play like the code-built one. Builds the map headless
// twice, as code (?tcstudio=0) and from the Studio files
// (models/tc-town.glb + maps/trollcity-layout.js), and checks:
//   - every Studio mesh found its material (no "doesn't make" warning)
//   - the colliders the game ends up with, the stair links, the spawns
//   - every RP spot (the rp spec, walked: bar, seats, jail, train ...)
//   - triangles drawn per material
//   - five views rendered the same (mean pixel difference)
// With --moved (Studio moved models), what's meant to differ is listed, not
// failed: colliders, stairs, RP spots, triangles, the views (--rp prints
// every RP value that moved, code -> Studio).
//
//   node tools/troll-ops-trollcity-contract-test.mjs [--moved [--rp]] [--shots <dir>]
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { serve } from "./troll-ops-map-capture.mjs";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = require(path.join(process.env.LOCALAPPDATA || "", "npm-cache/_npx/361ceb562f3b3235/node_modules/playwright"))); }
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const SHOTS = arg("--shots", null);
const MOVED = process.argv.includes("--moved"), RP = process.argv.includes("--rp");

const server = await serve(0);
const port = server.address().port;
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });

const VIEWS = [
  { name: "main-street", eye: [-30, 4, 2], at: [30, 3, 0] },
  { name: "aerial", eye: [50, 55, 80], at: [0, 0, -5] },
  { name: "saloon-bar", eye: [-14, 1.9, -11.5], at: [-6.5, 1.4, -18] },
  { name: "courthouse", eye: [30, 3, 6], at: [48, 3, -2] },
  { name: "station", eye: [-5, 3, -22], at: [-22, 2, -32] },
];

async function build(studio) {
  const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
  const errors = [], warns = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "warning" || m.type() === "error") warns.push(m.text()); if (process.env.DEBUG && m.text().startsWith("STEP")) console.log((studio ? "studio " : "code ") + m.text()); });
  await page.goto(`http://127.0.0.1:${port}/__export.html${studio ? "" : "?tcstudio=0"}`);
  const out = await page.evaluate(async ({ VIEWS }) => {
    const THREE = await import("three");
    const { buildMap, MAPS } = await import("/assets/games/troll-ops/maps/maps.js");
    const colliders = [], arena = {};
    const built = buildMap("trollcity", { colliders, arena });
    console.log("STEP built");
    // the GLB (and the gallery's art) load after the build
    await new Promise((r) => {
      const mgr = THREE.DefaultLoadingManager;
      let idle = 0;
      let n = 0;   // (some art never reports in headless: 20 s at most)
      const t = setInterval(() => { idle = mgr.itemsLoaded >= mgr.itemsTotal ? idle + 1 : 0; if (idle > 6 || ++n > 80) { clearInterval(t); r(); } }, 250);
    });
    await new Promise((r) => setTimeout(r, 1500));
    console.log("STEP loaded");
    const r4 = (v) => Math.round(v * 1000) / 1000;
    const cols = colliders.filter((c) => c.min.y > -50).map((c) => [...c.min.toArray(), ...c.max.toArray(), c.pen].map(r4).join(",")).sort();
    // every RP spot, walked as the exporter walks it
    const rp = [];
    const seen = new Set();
    const walk = (v, name, depth) => {
      if (v == null || depth > 6) return;
      if (typeof v === "function") { if (depth) return; try { v = v(); } catch { return; } }
      if (typeof v !== "object" || seen.has(v)) return;
      if (!Array.isArray(v) && v.constructor && v.constructor !== Object) return;
      seen.add(v);
      for (const [k, c] of Object.entries(v)) {
        if (typeof c === "number") rp.push(`${name}.${k}=${r4(c)}`);
        else walk(c, name + "." + k, depth + 1);
      }
    };
    for (const [k, v] of Object.entries(MAPS.trollcity.rp)) walk(v, "rp." + k, 0);
    // triangles per material
    const tris = {};
    built.root.updateMatrixWorld(true);
    built.root.traverse((o) => {
      if (!o.isMesh || !o.visible) return;
      const n = (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1);
      const key = (o.material.name || o.material.type) + (o.material.map ? "+map" : "");
      tris[key] = (tris[key] || 0) + n;
    });
    // five views, same light for both
    const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
    renderer.setSize(480, 270);
    document.body.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9cc0e0);
    scene.add(built.root, new THREE.HemisphereLight(0xffffff, 0x806040, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(42, 58, 30); scene.add(sun);
    const cam = new THREE.PerspectiveCamera(60, 480 / 270, 0.1, 600);
    const shots = [];
    for (const v of VIEWS) {
      cam.position.set(...v.eye); cam.lookAt(...v.at);
      renderer.render(scene, cam);
      console.log("STEP rendered " + v.name);
      shots.push(renderer.domElement.toDataURL("image/png"));
    }
    const px = [];
    for (const s of shots) {
      const img = new Image(); img.src = s; await img.decode();
      const c = new OffscreenCanvas(480, 270), g = c.getContext("2d"); g.drawImage(img, 0, 0);
      px.push(Array.from(g.getImageData(0, 0, 480, 270).data));
    }
    return { cols, rp, stairs: built.stairs.map((s) => JSON.stringify(s, (k, v) => (typeof v === "number" ? r4(v) : v))).sort(), spawns: built.spawnPoints.map((p) => p.toArray().map(r4).join(",")), tris, shots, px };
  }, { VIEWS });
  await page.close();
  return { ...out, errors, warns };
}

const code = await build(false), stud = await build(true);
await browser.close();
server.close();

let fails = 0;
const check = (name, ok, detail = "", soft = false) => {
  console.log(`${ok ? "PASS" : soft && MOVED ? "DIFF" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok && !(soft && MOVED)) fails++;
};
const diff = (a, b) => { const A = new Set(a), B = new Set(b); return [a.filter((x) => !B.has(x)), b.filter((x) => !A.has(x))]; };

check("no page errors", !code.errors.length && !stud.errors.length, [...code.errors, ...stud.errors].slice(0, 3).join(" | "));
check("every Studio mesh found its material", !stud.warns.some((w) => /Troll City/.test(w)), stud.warns.filter((w) => /Troll City/.test(w)).join(" | "));
{
  // matched within 2 mm (a box goes min/max -> centre/size -> min/max on the way)
  const nums = (c) => c.split(",").map(Number);
  const left = stud.cols.map(nums), lost = [];
  for (const c of code.cols.map(nums)) {
    const j = left.findIndex((d) => d && d.every((v, k) => Math.abs(v - c[k]) < 2e-3));
    if (j < 0) lost.push(c.join(",")); else left[j] = null;
  }
  const extra = left.filter(Boolean).map((d) => d.join(","));
  check("colliders", !lost.length && !extra.length, `${code.cols.length} vs ${stud.cols.length}; lost ${lost.length} ${lost.slice(0, 2).join(" ")}; extra ${extra.length} ${extra.slice(0, 2).join(" ")}`, true);
}
{
  const [lost, extra] = diff(code.stairs, stud.stairs);
  check("stair links", !lost.length && !extra.length, `${code.stairs.length} vs ${stud.stairs.length}${MOVED ? `: ${lost.join(" ")} -> ${extra.join(" ")}` : ""}`, true);
}
check("spawns", JSON.stringify(code.spawns) === JSON.stringify(stud.spawns), "", true);
{
  const [lost, extra] = diff(code.rp, stud.rp);
  check("RP spots", !lost.length && !extra.length, `${code.rp.length} values, ${lost.length} differ; ${lost.slice(0, 3).join(" ")} / ${extra.slice(0, 3).join(" ")}`, true);
  if (RP) {
    const now = new Map(stud.rp.map((v) => v.split("=")));
    for (const v of lost) { const [k, a] = v.split("="); console.log(`   ${k}: ${a} -> ${now.get(k)}`); }
  }
}
{
  const keys = new Set([...Object.keys(code.tris), ...Object.keys(stud.tris)]);
  const off = [...keys].filter((k) => code.tris[k] !== stud.tris[k]).map((k) => `${k}: ${code.tris[k] || 0} -> ${stud.tris[k] || 0}`);
  const total = (t) => Object.values(t).reduce((a, b) => a + b, 0);
  check("triangles per material", !off.length, `${total(code.tris)} vs ${total(stud.tris)}; ${off.slice(0, 4).join("; ")}`, true);
}
VIEWS.forEach((v, i) => {
  const a = code.px[i], b = stud.px[i];
  let sum = 0, big = 0;
  for (let k = 0; k < a.length; k += 4) {
    const d = (Math.abs(a[k] - b[k]) + Math.abs(a[k + 1] - b[k + 1]) + Math.abs(a[k + 2] - b[k + 2])) / 3;
    sum += d; if (d > 24) big++;
  }
  const mean = sum / (a.length / 4), share = big / (a.length / 4);
  check(`view ${v.name} renders the same`, mean < 1.5 && share < 0.01, `mean ${mean.toFixed(2)}/255, ${(share * 100).toFixed(2)}% pixels off`, true);
  if (SHOTS) {
    fs.mkdirSync(SHOTS, { recursive: true });
    for (const [tag, s] of [["code", code.shots[i]], ["studio", stud.shots[i]]]) fs.writeFileSync(path.join(SHOTS, `${v.name}-${tag}.png`), Buffer.from(s.split(",")[1], "base64"));
  }
});
console.log(fails ? `${fails} FAILED` : "all passed");
process.exit(fails ? 1 : 0);
