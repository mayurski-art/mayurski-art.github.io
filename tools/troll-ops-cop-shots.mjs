// Cops and Robbers: look at the officer body (cop-lab.html) in any pose, from
// any side, at any moment, and get one contact sheet back.
//
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-cop-shots.mjs
//   POSES=run,ads      poses (cop-lab.html's list)
//   YAW=-155,-90       body turn(s) in degrees (-155 = the lab's front three-quarter)
//   T=0.9 or 0,0.1,..  moment(s) in seconds: several make a strip of the cycle
//   LOOK=patrol|grin|stick   STICK=1 draws the stick rig over the body
//   CAM=x,y,z,tx,ty,tz camera and target; FOCUS=hand_l FDIR=dx,dy,dz aims it at a bone
//   GUN=<weapon id>    COLS=4  W=420 (cell width)
//   EVAL='js'          run in the page after the last pose (window.__lab), print the result
// Writes .claude/cop-shots/x-*.png and sheet.png.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, ".claude", "cop-shots");
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (f.startsWith("x-")) fs.unlinkSync(path.join(OUT, f));
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".glb": "model/gltf-binary", ".png": "image/png",
  ".jpg": "image/jpeg", ".webp": "image/webp", ".json": "application/json" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));

const E = process.env;
const list = (v, d) => (v || d).split(",");
const POSES = list(E.POSES, "ads"), YAWS = list(E.YAW, "-155"), TS = list(E.T, "0.9").map(Number);
const LOOK = E.LOOK || "patrol";
const W = +(E.W || 420);

const browser = await chromium.launch({ args: [`--use-angle=${E.ANGLE || "d3d11"}`, "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 700, height: 800 } });
page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
await page.goto(`http://localhost:${server.address().port}/assets/games/troll-ops/cop-lab.html?still=1&look=${LOOK === "stick" ? "" : LOOK}${E.GUN ? "&gun=" + E.GUN : ""}`);
await page.waitForFunction(() => !!window.__lab);
await page.evaluate(async () => { await window.__lab.ready(); });
const shots = [];
for (const pose of POSES) for (const yaw of YAWS) for (const t of TS) {
  const url = await page.evaluate(({ pose, yaw, t, stick, cam, focus, fdir }) => {
    const L = window.__lab;
    document.getElementById("yaw").value = yaw;
    document.getElementById("stick").checked = !!stick;
    L.pose(pose, t);
    if (cam) { L.camera.position.set(cam[0], cam[1], cam[2]); L.camera.lookAt(cam[3], cam[4], cam[5]); }
    if (focus && L.rig.cop) {
      const p = L.rig.cop.bones[focus].getWorldPosition(new L.THREE.Vector3());
      L.camera.position.set(p.x + fdir[0], p.y + fdir[1], p.z + fdir[2]);
      L.camera.lookAt(p);
    }
    L.render();
    return document.querySelector("canvas").toDataURL("image/png");
  }, { pose, yaw, t, stick: E.STICK, cam: E.CAM ? E.CAM.split(",").map(Number) : null, focus: E.FOCUS || null, fdir: (E.FDIR || "0,0.1,0.5").split(",").map(Number) });
  const name = `x-${LOOK}-${pose}-y${yaw}-t${t}.png`;
  fs.writeFileSync(path.join(OUT, name), Buffer.from(url.split(",")[1], "base64"));
  shots.push({ name, url });
}
if (E.EVAL) console.log(JSON.stringify(await page.evaluate((code) => eval(code), E.EVAL)));
const cols = +(E.COLS || Math.min(4, shots.length));
const sheet = await browser.newPage({ viewport: { width: cols * W, height: 400 } });
await sheet.setContent(`<style>body{margin:0;background:#111;display:grid;grid-template-columns:repeat(${cols},${W}px)}
figure{margin:0;position:relative}img{width:${W}px;display:block}figcaption{color:#ddd;font:12px sans-serif;position:absolute;top:4px;left:6px}</style>
${shots.map((s) => `<figure><img src="${s.url}"><figcaption>${s.name.replace(/^x-|\.png$/g, "")}</figcaption></figure>`).join("")}`);
await sheet.screenshot({ path: path.join(OUT, "sheet.png"), fullPage: true });
await browser.close();
server.close();
console.log(`${shots.length} shots -> .claude/cop-shots/sheet.png`);
