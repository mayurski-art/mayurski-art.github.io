// Troll City release poster, rendered from the game itself: seen from high
// above the plain south of town, a crowd of the game's own townsfolk stands
// in the shape of the trollface (traced from the operator's trollface art),
// "Troll City" raked into the dirt beside it, the town's roofs and the
// railway along the top. Writes
//   assets/games/troll-ops/ui/posters/troll-city-release.jpg  1200x1500
//   node tools/troll-city-poster.mjs [--draft] (--draft: half size, quicker)
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { ROOT, serve } from "./troll-ops-map-capture.mjs";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = require(path.join(process.env.LOCALAPPDATA || "", "npm-cache/_npx/361ceb562f3b3235/node_modules/playwright"))); }

const DRAFT = process.argv.includes("--draft");
const W = DRAFT ? 600 : 1200, H = DRAFT ? 750 : 1500;
const OUT = path.join(ROOT, "assets/games/troll-ops/ui/posters");
fs.mkdirSync(OUT, { recursive: true });
const FILE = path.join(OUT, DRAFT ? "troll-city-release-draft.jpg" : "troll-city-release.jpg");

const server = await serve(0);
const port = server.address().port;
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on("pageerror", (e) => console.log("page error:", e.message));
page.on("console", (m) => { if (m.type() === "error" || m.text().startsWith("POSTER")) console.log(m.text()); });
await page.route(/supabase/, (r) => r.abort());
await page.goto(`http://127.0.0.1:${port}/__export.html`);
await page.addStyleTag({ url: "https://fonts.googleapis.com/css2?family=Rye&family=Kaushan+Script&family=DM+Sans:wght@500;700&display=block" }).catch(() => console.log("POSTER: no web fonts"));

const jpg = await page.evaluate(async ({ W, H }) => {
  const THREE = await import("three");
  const { buildMap, MAPS } = await import("/assets/games/troll-ops/maps/maps.js");
  const { buildHumanoid, poseHumanoid } = await import("/assets/games/troll-ops/characters/character.js");
  for (const f of ["400px Rye", "400px 'Kaushan Script'", "700 40px 'DM Sans'"]) await document.fonts.load(f).catch(() => {});
  const R = (() => { let s = 20261019; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })();

  /* ------------------------------------------------ the town */
  const colliders = [], arena = {};
  const built = buildMap("trollcity", { colliders, arena });
  await new Promise((r) => {
    const mgr = THREE.DefaultLoadingManager;
    let idle = 0, n = 0;
    const t = setInterval(() => { idle = mgr.itemsLoaded >= mgr.itemsTotal ? idle + 1 : 0; if (idle > 6 || ++n > 80) { clearInterval(t); r(); } }, 250);
  });
  await new Promise((r) => setTimeout(r, 1500));
  const map = MAPS.trollcity;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(map.fog.color);
  scene.fog = new THREE.FogExp2(map.fog.color, 0.0016);
  scene.add(built.root);
  scene.add(new THREE.HemisphereLight(map.hemi.sky, map.hemi.ground, map.hemi.intensity));
  scene.add(new THREE.AmbientLight(map.ambient.color, map.ambient.intensity));
  // a late-afternoon sun from the west-south-west: long shadows across the crowd
  const sun = new THREE.DirectionalLight(map.sun.color, map.sun.intensity);
  const FACE = { x: -6, z: 98, w: 50 };
  sun.position.set(FACE.x - 60, 55, FACE.z + 30);
  sun.target.position.set(FACE.x, 0, FACE.z - 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 260 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  // (the low hill south of the loop stands where the crowd does: flattened)
  built.root.traverse((o) => { if (o.isMesh) { o.receiveShadow = true; if (o.material?.name === "hill") o.visible = false; } });

  /* ------------------------------------------------ the face, as points */
  const img = new Image();
  img.src = "/assets/games/troll-ops/troll-greencandles/character/trollface_operator_trollface%20transparent.png";
  await img.decode();
  const cv = new OffscreenCanvas(img.width, img.height), g = cv.getContext("2d");
  g.drawImage(img, 0, 0);
  const px = g.getImageData(0, 0, img.width, img.height).data;
  const dark = (u, v) => {
    const x = Math.round(u * (img.width - 1)), y = Math.round(v * (img.height - 1));
    const i = (y * img.width + x) * 4;
    return px[i + 3] > 128 && px[i] + px[i + 1] + px[i + 2] < 300;
  };
  const scale = FACE.w / img.width;     // metres a pixel
  const depth = img.height * scale;
  const STEP = 0.62;                    // shoulder to shoulder
  const spots = [];
  for (let z = 0; z < depth; z += STEP * 0.9) for (let x = 0; x < FACE.w; x += STEP) {
    const jx = x + (R() - 0.5) * 0.3, jz = z + (R() - 0.5) * 0.3;
    if (!dark(jx / FACE.w, jz / depth)) continue;
    spots.push([FACE.x - FACE.w / 2 + jx, FACE.z - depth / 2 + jz]);
  }
  // stragglers walking in, and a few onlookers
  const stray = [];
  for (let i = 0; i < 46; i++) {
    const a = R() * Math.PI * 2, r = 0.62 + R() * 0.45;
    stray.push([FACE.x + Math.cos(a) * FACE.w * r * 0.62, FACE.z + Math.sin(a) * depth * r * 0.62]);
  }
  console.log(`POSTER: ${spots.length} in the face, ${stray.length} around it`);

  /* ------------------------------------------------ the crowd */
  // A few townsfolk posed (standing, mid-step, waving up at the camera),
  // each copied into instanced meshes: one draw a mesh of the body, not
  // one a person.
  const black = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.7, metalness: 0.1 });
  const variants = [];
  for (const [k, arg] of [
    ["stand", { phase: 0, moving: false, pitch: 0, lower: 0, strafe: 0, forward: 0, speed: 0, mps: 0, dt: 0.016, hold: "none" }],
    ["stand2", { phase: 1.7, moving: false, pitch: 0.3, lower: 0, strafe: 0, forward: 0, speed: 0, mps: 0, dt: 0.016, hold: "none" }],
    ["walk", { phase: 0.8, moving: true, pitch: 0, lower: 0, strafe: 0, forward: 1, speed: 0.5, mps: 1.6, dt: 0.016, hold: "none" }],
    ["walk2", { phase: 2.4, moving: true, pitch: 0, lower: 0, strafe: 0, forward: 1, speed: 0.5, mps: 1.6, dt: 0.016, hold: "none" }],
  ]) {
    const rig = buildHumanoid(black, { height: 1.78, build: 1, gun: false });
    rig.face = "grin:og";
    for (let i = 0; i < 4; i++) poseHumanoid(rig, arg);
    rig.root.updateMatrixWorld(true);
    const meshes = [];
    rig.root.traverse((o) => { if (o.isMesh && o.visible && o.geometry?.attributes?.position) meshes.push(o); });
    variants.push({ k, meshes });
  }
  const people = [...spots.map((p) => ({ p, crowd: true })), ...stray.map((p) => ({ p, crowd: false }))];
  // look up at the camera, or about
  const byVariant = variants.map(() => []);
  for (const q of people) {
    const v = q.crowd ? (R() < 0.75 ? (R() < 0.5 ? 0 : 1) : 2 + (R() < 0.5 ? 0 : 1)) : 2 + (R() < 0.5 ? 0 : 1);
    const yaw = q.crowd ? Math.PI + (R() - 0.5) * 1.4 : R() * Math.PI * 2;
    const s = 0.93 + R() * 0.14;
    byVariant[v].push(new THREE.Matrix4().compose(new THREE.Vector3(q.p[0], 0, q.p[1]), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(s, s, s)));
  }
  const tmp = new THREE.Matrix4();
  variants.forEach((v, vi) => {
    const list = byVariant[vi];
    if (!list.length) return;
    for (const m of v.meshes) {
      const im = new THREE.InstancedMesh(m.geometry, m.material, list.length);
      list.forEach((M, i) => im.setMatrixAt(i, tmp.multiplyMatrices(M, m.matrixWorld)));
      im.castShadow = true;
      im.receiveShadow = true;
      im.frustumCulled = false;
      scene.add(im);
    }
  });

  /* ------------------------------------------------ "Troll City" raked into the dirt */
  {
    const tw = 2048, th = 512;
    const c = document.createElement("canvas"); c.width = tw; c.height = th;
    const x = c.getContext("2d");
    x.font = "330px 'Kaushan Script'";
    x.textAlign = "center"; x.textBaseline = "middle";
    // the groove: a dark rim, the turned earth paler inside
    x.lineJoin = "round";
    x.strokeStyle = "rgba(90,60,30,0.55)"; x.lineWidth = 26; x.strokeText("Troll City", tw / 2, th / 2 + 8);
    x.fillStyle = "#f3e2b8"; x.fillText("Troll City", tw / 2, th / 2);
    x.globalCompositeOperation = "source-atop";
    for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(${R() < 0.5 ? "120,85,45" : "255,245,220"},${0.15 + R() * 0.25})`; x.fillRect(R() * tw, R() * th, 2 + R() * 5, 2 + R() * 3); }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    const len = 40;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(len, len * th / tw), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 1, depthWrite: false }));
    plane.rotation.set(-Math.PI / 2, 0, Math.PI / 2 - 0.1);   // reading up the frame, along the face's right
    plane.position.set(FACE.x + FACE.w / 2 + 7.5, 0.05, FACE.z + 2);
    plane.receiveShadow = true;
    scene.add(plane);
  }

  /* ------------------------------------------------ render */
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = map.exposure ?? 1.2;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.style.margin = "0";
  document.body.appendChild(renderer.domElement);
  const cam = new THREE.PerspectiveCamera(42, W / H, 1, 700);
  cam.position.set(FACE.x + 6, 104, FACE.z + 44);
  cam.lookAt(FACE.x + 6, 0, FACE.z - 16);
  renderer.render(scene, cam);
  console.log("POSTER: rendered");

  /* ------------------------------------------------ type */
  const out = document.createElement("canvas"); out.width = W; out.height = H;
  const x = out.getContext("2d");
  x.drawImage(renderer.domElement, 0, 0);
  const u = W / 1200;
  // a warm grade and a soft vignette
  const vg = x.createRadialGradient(W / 2, H * 0.55, H * 0.25, W / 2, H * 0.55, H * 0.8);
  vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(30,15,0,0.45)");
  x.fillStyle = vg; x.fillRect(0, 0, W, H);
  // NOW PLAYABLE across the foot
  const foot = x.createLinearGradient(0, H * 0.78, 0, H);
  foot.addColorStop(0, "rgba(20,12,4,0)"); foot.addColorStop(1, "rgba(20,12,4,0.78)");
  x.fillStyle = foot; x.fillRect(0, H * 0.7, W, H * 0.3);
  x.textAlign = "center";
  x.fillStyle = "#f6e7c4";
  x.shadowColor = "rgba(0,0,0,0.55)"; x.shadowBlur = 18 * u; x.shadowOffsetY = 4 * u;
  x.font = `${112 * u}px Rye`;
  x.fillText("NOW PLAYABLE", W / 2, H - 150 * u);
  x.shadowBlur = 8 * u; x.shadowOffsetY = 2 * u;
  x.font = `700 ${30 * u}px 'DM Sans'`;
  x.fillStyle = "#ffd98a";
  x.fillText("TROLL FORCES  ·  SOCIALIZE  ·  VERSUS  ·  ZOMBIES", W / 2, H - 92 * u);
  x.font = `500 ${26 * u}px 'DM Sans'`;
  x.fillStyle = "#f6e7c4";
  x.fillText("Play free at trollrunner.net/tf", W / 2, H - 52 * u);
  x.shadowColor = "transparent";
  // the sticker, bottom left
  {
    const sx = 40 * u, sy = H - 128 * u, sw = 132 * u, sh = 84 * u;
    x.fillStyle = "#fff"; x.fillRect(sx, sy, sw, sh);
    x.fillStyle = "#000"; x.fillRect(sx + 4 * u, sy + 4 * u, sw - 8 * u, sh - 8 * u);
    x.fillStyle = "#fff"; x.fillRect(sx + 4 * u, sy + 26 * u, sw - 8 * u, 32 * u);
    x.textAlign = "center";
    x.font = `700 ${14 * u}px 'DM Sans'`; x.fillStyle = "#fff"; x.fillText("PARENTAL", sx + sw / 2, sy + 20 * u);
    x.font = `700 ${25 * u}px 'DM Sans'`; x.fillStyle = "#000"; x.fillText("ADVISORY", sx + sw / 2, sy + 51 * u);
    x.font = `700 ${11.5 * u}px 'DM Sans'`; x.fillStyle = "#fff"; x.fillText("TROLLING CONTENT", sx + sw / 2, sy + 74 * u);
  }
  return out.toDataURL("image/jpeg", 0.9);
}, { W, H });

fs.writeFileSync(FILE, Buffer.from(jpg.split(",")[1], "base64"));
console.log(`wrote ${path.relative(ROOT, FILE)}`);
await browser.close();
server.close();
