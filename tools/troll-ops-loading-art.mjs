// The boot loading screen's key art (troll-ops.html #to-loading), rendered
// from the game itself (user, 2026-10-28: promo art is always rendered from
// the game, never a pre-existing image): Trollface Island through the
// game's own renderer and post chain, Halloween dressed, and the squad seen
// from behind on the Troll Peak, looking out over the island: two trollface
// stick operators and TROLLS #1272, the sheriff (user, 2026-10-31). The
// idea (a squad on a high point over the world) is from the user's
// reference, refs/loading-screen/NOTES.md; none of its art is used.
//
// Writes two framings of the same scene, so every screen crops safely:
//   assets/games/troll-ops/ui/boot/key-art-wide.webp   2560 x 1440 (desktop,
//                                                      ultrawide, phone landscape)
//   assets/games/troll-ops/ui/boot/key-art-tall.webp   1440 x 2560 (phone portrait)
// and, for the boot screen's moving layers (menu/boot-screen.js):
//   ui/boot/key-art-anchors.json   the moon, each jack-o'-lantern and the
//                                  plane, per look and frame, as shares of
//                                  the picture's width and height
//   ui/boot/plane[-halloween].webp the C-130 alone, on a clear background
// The render is pushed past the game's High tier (user, 2026-10-31: ultra
// "regardless if users have graphics low medium or high"): the picture is
// the same file for everyone.
// Two looks (user, 2026-10-31: "a normal version and then a halloween
// version"; the boot screen's pumpkin button swaps them): the scene file's
// "season" ("off" | "halloween") and "suffix" ("" | "-halloween"):
//   node tools/troll-ops-loading-art.mjs                                       normal
//   SCENE=troll-ops-loading-art-halloween.json node tools/troll-ops-loading-art.mjs
//
// A private room code and no bots, Supabase blocked: never a public room.
//
//   node tools/troll-ops-loading-art.mjs
//   PROBE=1  print the ground heights round the island (finds the high point)
//   TRY=1    every CAMS candidate small, to .claude/loading-art-try/
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let chromium;
for (const base of [ROOT, path.resolve(ROOT, "../../.."), process.cwd()]) {
  try { ({ chromium } = createRequire(path.join(base, "node_modules", "x.js"))("playwright")); break; } catch {}
}
if (!chromium) throw new Error("playwright not found");

const TRY = !!process.env.TRY;
const OUT = path.join(ROOT, "assets/games/troll-ops/ui/boot");
const TRYDIR = path.join(ROOT, ".claude/loading-art-try");
for (const d of [OUT, TRYDIR]) fs.mkdirSync(d, { recursive: true });

// the scene: troll-ops-loading-art.json (SCENE=<file> for another)
const SCENE = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), process.env.SCENE || "troll-ops-loading-art.json"), "utf8"));
/* `rig` places everything from one heading off the peak's centre (degrees,
   0 = +z, 90 = +x): the squad on the disc's rim facing out, a jack-o'-lantern
   either side, and each frame's camera behind and above their heads.
   frames.<name>.shots: [back m, up m, pitch deg, fov, heading offset deg]. */
if (SCENE.rig) {
  const { centre: [cx, cz], top, radius } = SCENE.rig, heading = +(process.env.HEADING ?? SCENE.rig.heading);
  const at = (h, r, side = 0) => {
    const a = h * Math.PI / 180, dx = Math.sin(a), dz = Math.cos(a);
    return [cx + dx * r - dz * side, cz + dz * r + dx * side];   // side: + = the camera's right
  };
  // each member: side (m, + = the camera's right), back (m toward the
  // camera), turn: looks back over the squad at the camera instead of out
  const camAt = at(heading, radius - (SCENE.rig.camBack ?? 3));
  SCENE.cast = SCENE.squad.map((m) => {
    const side = m.side ?? 0, back = m.back ?? 0;
    return { ...m, at: at(heading, radius - back, side), face: m.turn ? camAt : at(heading + side * 2, 400) };
  });
  const faceCam = (heading + 180) * Math.PI / 180;
  // jack-o'-lanterns on the rim at their feet, carved faces to the camera
  SCENE.pumpkins = (SCENE.rig.pumpkins || []).map(([dr, side, r]) => [...at(heading, radius + dr, side), r, faceCam]);
  // the C-130 high over the island ahead, the drone off the squad's shoulder
  if (SCENE.rig.c130) { const [off, r, y, s] = SCENE.rig.c130; SCENE.c130 = [[...at(heading + off, r).slice(0, 1), y, at(heading + off, r)[1], (heading + 90) * Math.PI / 180, s]]; }
  if (SCENE.rig.moon) { const [off, elev, r, size] = SCENE.rig.moon; const [x, z] = at(heading + off, r); SCENE.moon = [x, top + Math.tan(elev * Math.PI / 180) * r, z, size]; }
  if (SCENE.rig.drone) { const [r, side, up, s] = SCENE.rig.drone; const [x, z] = at(heading, r, side); SCENE.drone = [x, top + up, z, heading * Math.PI / 180, s]; }
  for (const f of Object.values(SCENE.frames)) {
    if (f.moon || f.c130) f.place = {};
    if (f.moon) { const [off, elev, r] = f.moon; const [x, z] = at(heading + off, r); f.place.moon = [x, top + Math.tan(elev * Math.PI / 180) * r, z]; }
    if (f.c130) { const [off, r, y] = f.c130; const [x, z] = at(heading + off, r); f.place.c130 = [x, y, z]; }
    if (!f.shots) continue;
    f.cams = f.shots.map(([back, up, pitch, fov, off = 0]) => {
      const [x, z] = at(heading + off, radius - back), y = top + up;
      const [lx, lz] = at(heading + off, radius - back + 100);
      return [x, y, z, lx, y - Math.tan(pitch * Math.PI / 180) * 100, lz, fov];
    });
  }
}

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".mp3": "audio/mpeg", ".svg": "image/svg+xml",
  ".gif": "image/gif", ".mp4": "video/mp4", ".webm": "video/webm", ".ktx2": "image/ktx2" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ args: [`--use-angle=${process.env.ANGLE || "d3d11"}`, "--ignore-gpu-blocklist",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.route(/supabase/, (r) => r.abort());

const page = await ctx.newPage();
page.on("pageerror", (e) => console.log(`page: ${e.message}`));
page.on("console", (m) => { if (m.text().startsWith("ART")) console.log(m.text()); });
await page.goto(`${BASE}/troll-ops.html?tohooks=1&season=${SCENE.season || "halloween"}`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 120000 });
await page.evaluate(async () => {
  const T = window.__trollOps;
  T.DROP.enabled = false; T.settings.gfx = "high"; T.setMode("royale");
  if (T.els.noBots) T.els.noBots.checked = true;
  T.els.room.value = "PV" + Math.random().toString(36).slice(2, 5).toUpperCase();   // private, never public
  T.els.room.dispatchEvent(new Event("input"));
  T.loadout.mapId = "trollface";
  await T.startGame();
  if (T.isStaging()) T.endStaging();
});
await page.waitForFunction(() => window.__trollOps.loadedMapId() === "trollface" && !window.__trollOps.loadState().open, null, { timeout: 240000 }).catch(() => {});
await new Promise((r) => setTimeout(r, +(process.env.WAIT || 12000)));   // models + textures stream in
const map = await page.evaluate(() => window.__trollOps.loadedMapId());
if (map !== "trollface") throw new Error(`loaded ${map}, not trollface`);
await page.evaluate((storm0) => {
  const T = window.__trollOps;
  for (const p of T.composer.passes) {
    for (const k of ["uHitFlash", "uLowHp", "uAberration", "uSuppress"]) if (p.uniforms?.[k]) p.uniforms[k].value = 0;
    if (p.constructor.name === "ViewmodelPass") p.enabled = false;
  }
  if (T.localRig?.root) T.localRig.root.visible = false;
  const roy = T.royale?.();
  // no storm (user, 2026-10-31: "remove the ring"): the island under a
  // clear Halloween night; the loot beams go too. STORM=1 keeps it
  if (roy) for (const m of [roy.loot?.beams, roy.loot?.rings, roy.visual?.next]) if (m) m.visible = false;
  if (roy?.visual?.group && storm0) roy.visual.group.visible = false;
  for (const it of roy?.loot?.items?.values?.() || []) if (it.mesh) it.mesh.visible = false;
}, process.env.STORM !== "1");

// Ultra, whatever the player's Graphics option: 4096 soft shadows, GTAO at
// 32 samples, the sky's clouds at full quality, every texture at the GPU's
// top anisotropy
await page.evaluate(async () => {
  const T = window.__trollOps, THREE = T.THREE, R = T.renderer;
  R.shadowMap.type = THREE.PCFSoftShadowMap;
  const aniso = R.capabilities.getMaxAnisotropy();
  T.scene.traverse((o) => {
    if (o.isDirectionalLight && o.castShadow) { o.shadow.mapSize.set(4096, 4096); o.shadow.map?.dispose(); o.shadow.map = null; }
    if (o.isMesh) for (const m of [].concat(o.material)) for (const k of ["map", "normalMap", "roughnessMap", "emissiveMap"]) {
      const t = m?.[k];
      if (t?.isTexture && t.anisotropy < aniso && t.generateMipmaps !== false) { t.anisotropy = aniso; t.needsUpdate = true; }
    }
  });
  R.shadowMap.needsUpdate = true;
  for (const p of T.composer.passes) if (p.constructor.name === "GTAOPass") { p.enabled = true; try { p.updateGtaoMaterial({ samples: 32 }); } catch {} }
  try {
    const u = performance.getEntriesByType("resource").map((e) => e.name).find((n) => n.includes("/view/sky.js"));
    (await import(u || "/assets/games/troll-ops/view/sky.js")).setSkyCloudQuality?.(2);
  } catch {}
});

// NEAR=x,z,r: every mesh standing within r of (x, z) that tops the peak's disc
if (process.env.NEAR) {
  console.log(await page.evaluate((P) => {
    const T = window.__trollOps, THREE = T.THREE, out = [];
    const [x, z, r] = P.split(",").map(Number), b = new THREE.Box3(), c = new THREE.Vector3();
    const m4 = new THREE.Matrix4(), p = new THREE.Vector3();
    T.scene.traverse((o) => {
      if (o.isInstancedMesh) {
        // which instances stand near
        const near = [];
        for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m4); p.setFromMatrixPosition(m4).applyMatrix4(o.matrixWorld); if (Math.hypot(p.x - x, p.z - z) < r && p.y > 25) near.push(`#${i} ${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)}`); }
        if (near.length) out.push(`INSTANCED ${o.name || "?"} / ${o.parent?.name || ""} x${o.count}: ${near.join(" ")}`);
        return;
      }
      if (!o.isMesh && !o.isSprite && !o.isLine && !o.isPoints) return;
      b.setFromObject(o); b.getCenter(c);
      if (b.max.y < 29 || Math.hypot(c.x - x, c.z - z) > r || b.max.x - b.min.x > 40) return;
      out.push(`${o.name || "?"} / ${o.parent?.name || ""} ${o.isInstancedMesh ? "x" + o.count : ""} at ${c.x.toFixed(1)},${c.z.toFixed(1)} y${b.min.y.toFixed(1)}-${b.max.y.toFixed(1)} ${(b.max.x - b.min.x).toFixed(1)}x${(b.max.z - b.min.z).toFixed(1)} ${o.visible ? "" : "HIDDEN"}`);
    });
    return out.join("\n");
  }, process.env.NEAR));
  await browser.close(); server.close(); process.exit(0);
}
// AT=x,y,z: every mesh whose box holds that point (what's in the camera's way)
if (process.env.AT) {
  console.log(await page.evaluate((P) => {
    const T = window.__trollOps, THREE = T.THREE, out = [];
    const p = new THREE.Vector3(...P.split(",").map(Number)), b = new THREE.Box3();
    T.scene.traverse((o) => {
      if (!o.isMesh) return;
      b.setFromObject(o);
      if (b.containsPoint(p)) out.push(`${o.name || "?"} / ${o.parent?.name || ""} ${o.isInstancedMesh ? "x" + o.count : ""} y${b.min.y.toFixed(1)}-${b.max.y.toFixed(1)} ${(b.max.x - b.min.x).toFixed(1)}x${(b.max.z - b.min.z).toFixed(1)}`);
    });
    return out.join(" | ");
  }, process.env.AT));
  await browser.close(); server.close(); process.exit(0);
}
if (process.env.PROBE) {
  console.log(await page.evaluate((P) => {
    const T = window.__trollOps, THREE = T.THREE;
    const ray = new THREE.Raycaster(), solids = [];
    T.scene.traverse((o) => { if (o.isMesh && o.visible && !o.isSkinnedMesh && !o.material?.transparent && o.material?.depthWrite !== false) solids.push(o); });
    const out = [];
    let best = [];
    const [X0,X1,Z0,Z1,ST]=((P.split(",").length>1)?P:"-210,210,-160,160,10").split(",").map(Number);
    for (let z = Z0; z <= Z1; z += ST) {
      const row = [];
      for (let x = X0; x <= X1; x += ST) {
        ray.set(new THREE.Vector3(x, 300, z), new THREE.Vector3(0, -1, 0));
        const hit = ray.intersectObjects(solids, false).find((h) => h.face && h.face.normal.y > 0.4 && h.object.visible);
        const y = hit ? hit.point.y : -99;
        row.push(y < -50 ? "  ." : String(Math.round(y)).padStart(3));
        best.push([y, x, z]);
      }
      out.push(String(z).padStart(5) + " " + row.join(""));
    }
    best.sort((a, b) => b[0] - a[0]);
    const names = best.slice(0, 6).map((b) => { ray.set(new THREE.Vector3(b[1], 300, b[2]), new THREE.Vector3(0, -1, 0)); const h = ray.intersectObjects(solids, false)[0]; return h ? (h.object.name || h.object.parent?.name || "?") : "-"; });
    return "x from -210 step 10\n" + out.join("\n") + "\nhighest: " + best.slice(0, 12).map((b) => `${b[1]},${b[2]} y${b[0].toFixed(1)}`).join(" | ") + "\n" + names.join("\n");
  }, process.env.PROBE));
  await browser.close(); server.close(); process.exit(0);
}

/* `float` (user, 2026-10-31: "the trollface island facing frontward and the
   5 characters floating in the air"): the camera south of Troll City looking
   north at the dome's carved face, the squad hanging in the air in front of
   it, placed per frame off the camera (placeCast). Everything is relative to
   the city landmark (maps/trollface-island.js LANDMARKS):
     frames.<name>.shots: [back m (south), up m, look-at y, fov]
     frames.<name>.cast:  { dist, feet, spread, scale }   the squad off the camera
     float.pumpkins:      [[dx, dz, r]] on the ground
     frames.<name>.moon / c130: [dx, y, dz] */
if (SCENE.float) {
  const LM = await page.evaluate(async () => {
    const u = performance.getEntriesByType("resource").map((e) => e.name).find((n) => n.includes("/maps/trollface-island.js"));
    const M = await import(u); return M.LANDMARKS;
  });
  const c = LM[SCENE.float.at || "city"];
  console.log(`ART ${SCENE.float.at || "city"} at ${c.x.toFixed(1)}, ${c.z.toFixed(1)}`);
  SCENE.cast = SCENE.squad;
  SCENE.pumpkins = (SCENE.float.pumpkins || []).map(([dx, dz, r]) => [c.x + dx, c.z + dz, r, 0]);
  if (SCENE.float.c130) { const [dx, y, dz, yaw, sc] = SCENE.float.c130; SCENE.c130 = [[c.x + dx, y, c.z + dz, yaw, sc]]; }
  if (SCENE.float.moon) { const [dx, y, dz, r] = SCENE.float.moon; SCENE.moon = [c.x + dx, y, c.z + dz, r]; }
  for (const f of Object.values(SCENE.frames)) {
    f.place = {};
    if (f.moon) f.place.moon = [c.x + f.moon[0], f.moon[1], c.z + f.moon[2]];
    if (f.c130) f.place.c130 = [c.x + f.c130[0], f.c130[1], c.z + f.c130[2]];
    f.cams = f.shots.map(([back, up, lookY, fov, side = 0]) => [c.x + side, up, c.z + back, c.x + side, lookY, c.z, fov]);
  }
}

/* The squad, the Halloween dressing and the sky, in the live scene. */
await page.evaluate(async (S) => {
  const T = window.__trollOps, THREE = T.THREE, scene = T.scene;
  const urlOf = (part) => performance.getEntriesByType("resource").map((e) => e.name).find((n) => n.includes(part));
  // the instance the game already loaded, else the module fresh (three is shared through the import map)
  const need = async (part) => import(urlOf(part) || "/assets/games/troll-ops" + part);
  const C = await need("/characters/character.js");
  const B = await need("/characters/blocky-body.js");
  const WM = await need("/weapons/weapon-model.js");
  const W = await need("/weapons/weapons.js");
  const J = await need("/maps/jack-o-lantern.js");

  const ray = new THREE.Raycaster();
  const solids = [];
  scene.traverse((o) => { if (o.isMesh && o.visible && !o.isSkinnedMesh && !o.material?.transparent && o.material?.depthWrite !== false) solids.push(o); });
  const groundAt = (x, z) => {
    ray.set(new THREE.Vector3(x, 300, z), new THREE.Vector3(0, -1, 0));
    const hit = ray.intersectObjects(solids, false).find((h) => h.face && h.face.normal.y > 0.4);
    return hit ? hit.point.y : 0;
  };
  window.__ground = groundAt;
  // the peak's top cleared for the squad: the cabin, the flag and the crates
  // on the disc stand behind and between them (staging only, the map keeps them)
  if (S.clear) {
    const [cx, cz, r, above] = S.clear, box = new THREE.Box3(), c = new THREE.Vector3();
    const hide = [];
    scene.traverse((o) => {
      if (!o.isMesh || !o.visible) return;
      box.setFromObject(o); box.getCenter(c);
      // anything standing on the disc (the cabin, the flag and its pole, the
      // lamp, the crates): its top above the disc, small, not the peak itself
      if (box.max.y > above && Math.hypot(c.x - cx, c.z - cz) < r && box.max.y - box.min.y < 20 && box.max.x - box.min.x < 20) hide.push(o);
    });
    for (const o of hide) o.visible = false;
    // the flag and its pole are part of the peak's own mesh: its triangles
    // above the disc inside the clearing go (the disc itself stays)
    let cut = 0;
    scene.traverse((o) => {
      if (!o.isMesh || !o.visible || !/^tf-peak/.test(o.name)) return;
      box.setFromObject(o);
      if (box.max.x - box.min.x < 20) return;
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
      const pos = g.attributes.position, keep = [];
      const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
      // by the triangle's centre: the disc's top (flat at the disc's height)
      // stays, the pole's sides (their centres well above it) go
      for (let t = 0; t < pos.count; t += 3) {
        let y = 0, x = 0, z = 0;
        for (let k = 0; k < 3; k++) {
          v[k].fromBufferAttribute(pos, t + k).applyMatrix4(o.matrixWorld);
          y += v[k].y / 3; x += v[k].x / 3; z += v[k].z / 3;
        }
        if (y > above + 0.9 && Math.hypot(x - cx, z - cz) < r) cut++; else keep.push(t, t + 1, t + 2);
      }
      if (!cut) return;
      const ng = new THREE.BufferGeometry();
      for (const name in g.attributes) {
        const a = g.attributes[name], arr = new a.array.constructor(keep.length * a.itemSize);
        keep.forEach((i, j) => { for (let k = 0; k < a.itemSize; k++) arr[j * a.itemSize + k] = a.array[i * a.itemSize + k]; });
        ng.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize, a.normalized));
      }
      if (g.groups?.length) { /* one material: no groups */ }
      o.geometry = ng;
    });
    console.log(`ART cut ${cut} peak triangles`);
    // the cabin is in the peak's own mesh: one-sided, so a camera standing
    // inside it sees straight out through its walls
    let culled = 0;
    scene.traverse((o) => {
      if (!o.isMesh || !/^tf-peak/.test(o.name)) return;
      for (const m of [].concat(o.material)) if (m.side !== THREE.FrontSide) { m.side = THREE.FrontSide; m.needsUpdate = true; culled++; }
    });
    console.log(`ART cleared ${hide.length} meshes off the peak, ${culled} peak materials one-sided`);
  }
  // dusk: the sun low and orange ahead of the squad (they read as
  // silhouettes with a warm rim), the fill cooled and dimmed
  // (every key optional: the normal look grades only in post)
  if (S.grade) {
    const g = S.grade;
    scene.traverse((o) => {
      if (o.isDirectionalLight) {
        if (g.sun) o.color.set(g.sun);
        if (g.sunK) o.intensity *= g.sunK;
        if (g.sunAt) { o.position.set(...g.sunAt); o.target.position.set(...g.sunTarget); o.target.updateMatrixWorld(); }
      }
      if (o.isHemisphereLight) { if (g.fillK) o.intensity *= g.fillK; if (g.sky) o.color.set(g.sky); if (g.ground) o.groundColor.set(g.ground); }
      if (o.isAmbientLight) { if (g.fillK) o.intensity *= g.fillK; if (g.sky) o.color.set(g.sky); }
    });
    if (g.exposure) T.renderer.toneMappingExposure *= g.exposure;
    // the island's fog (trollface-island.js: dark blue at the far edge):
    // Halloween's is thicker and violet, the far city dissolving into it
    if (g.fog && scene.fog) { if (g.fog.color) scene.fog.color.set(g.fog.color); if (g.fog.density) scene.fog.density = g.fog.density; }
    // the sky dome's own colours (view/sky.js): Halloween's violet night
    if (g.skyDome) {
      const SK = await need("/view/sky.js"), u = SK.skyMat.uniforms;
      if (g.skyDome.top) u.uTop.value.set(g.skyDome.top);
      if (g.skyDome.horizon) u.uHorizon.value.set(g.skyDome.horizon);
      if (g.skyDome.bottom) u.uBottom.value.set(g.skyDome.bottom);
    }
    // the island is lit from its light maps (phase 6), which the lights above
    // don't touch: moonlight means tinting every map material cool and
    // turning the baked light down (the cast, the slab and the lanterns are
    // added after this, so they keep their own colour)
    if (g.tint || g.lightMapK) {
      const tint = g.tint ? new THREE.Color(g.tint) : null, seen = new Set();
      scene.traverse((o) => {
        if (!o.isMesh) return;
        for (const m of [].concat(o.material)) {
          if (!m || seen.has(m) || !m.color) continue;
          seen.add(m);
          if (tint) m.color.multiply(tint);
          if (g.lightMapK && m.lightMap) m.lightMapIntensity *= g.lightMapK;
        }
      });
    }
    // the game's own colour grade (view/grade-pass.js): sat, contrast, and a
    // split tone { shadows, shadowsAmt, highlights, highlightsAmt }
    if (g.post) for (const p of T.composer.passes) if (p.setGrade) p.setGrade(g.post);
  }
  const black = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.7, metalness: 0.1 });
  const LOW_READY = 1.2, PORT_YAW = 1.15, PORT_ROLL = 0.5;
  for (const m of S.cast) {
    const h = C.buildHumanoid(black, { height: 1.8, gun: false });
    // a TROLLS body, else the stick rig with the NPCs' 3D trollface head
    // (the menu's own operator: menu/char-inspector.js)
    if (m.token) await B.wearBlocky(h, m.token); else await B.setReliefFace(h);
    // a Pumpkin Head (characters/pumpkin-head.js, the Locker's cosmetic: a
    // solid carved rind lit from inside) in place of the trollface
    const PH = m.head === "pumpkin" ? await need("/characters/pumpkin-head.js") : null;
    if (PH) h.face = "grin:og:::pumpkin";
    let held = null;
    if (m.gun && W.WEAPON_DEFS[m.gun]) {
      held = WM.buildWeaponMesh(W.WEAPON_DEFS[m.gun], { skin: m.skin ?? null });
      C.mountHeldWeapon(h, held);
    }
    // floating: yaw is local to the member's group (placeCast turns it to
    // the camera): 0 looks out with the camera, turned looks back at it
    const yaw = S.float ? (m.turn ? Math.PI : 0) : Math.atan2(-(m.face[0] - m.at[0]), -(m.face[1] - m.at[1]));
    if (!S.float) h.root.position.set(m.at[0], groundAt(m.at[0], m.at[1]), m.at[1]);
    C.aimRig(h, yaw, 0, { snap: true });
    h.noIdleGlance = true;
    for (let i = 0; i < 6; i++) {
      C.aimRig(h, yaw, 0.016);
      const port = m.pose !== "aim";
      C.poseHumanoid(h, {
        moving: false, phase: 0, forward: 0, strafe: 0, lower: 0, speed: 0, mps: 0, dt: 0.016,
        pitch: port ? LOW_READY : 0, hold: held ? "gun" : "none", hasGun: !!held,
        ...(port && held ? { carryYaw: PORT_YAW, carryRoll: PORT_ROLL } : {}),
      });
      if (port) { h.parts.neckPivot.rotation.x -= LOW_READY * 0.25; h.parts.headPivot.rotation.x -= LOW_READY * 0.35; }
      h.body?.update?.();
    }
    // a stick operator's head is the flat trollface board, drawn both sides:
    // from behind it would read mirrored, so the board turns to read true
    h.root.traverse((o) => { if (o.userData?.trollface && S.trueFace) o.scale.x = -1; });
    if (PH) PH.syncHeadwear(h);
    h.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    if (S.float) { const g = new THREE.Group(); g.add(h.root); scene.add(g); (window.__cast ||= []).push({ g, m }); }
    else scene.add(h.root);
  }

  const carve = J.carveTexture();
  const jack = (parent, x, y, z, r, face, seed) => {
    const pc = J.jackPieces(x, y, z, { r, face, seed });
    const add = (geo, mat) => { if (!geo) return; const m = new THREE.Mesh(geo, mat); m.castShadow = true; parent.add(m); };
    add(pc.body, new THREE.MeshStandardMaterial({ color: pc.hue, roughness: 0.6 }));
    add(pc.stem, new THREE.MeshStandardMaterial({ color: 0x4a5a22, roughness: 0.9 }));
    add(pc.carve, new THREE.MeshBasicMaterial({ map: carve, transparent: true, color: 0xffb040, toneMapped: false }));
    const l = new THREE.PointLight(0xff8a2a, (S.pumpkinLight ?? 1.2) * r / 0.3, 14 * r, 1.8); l.position.set(x, y + r, z); parent.add(l);
  };
  // the squad's own ground (user, 2026-10-31: "standing on some imaginary
  // piece of land"): a chunk of the island hanging in the air in front of
  // the camera, grass on top, the peak's violet rock below, crags under it,
  // two jack-o'-lanterns at their feet; placeCast carries it with the squad
  if (S.float?.slab) {
    const { w, d, depth = 2.6 } = S.float.slab;
    const g = new THREE.Group(); g.name = "slab";
    let seed = 7; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const blob = (k0) => { const sh = new THREE.Shape(), N = 16; for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2, k = k0 * (0.86 + rnd() * 0.24); const p = [Math.cos(a) * w / 2 * k, Math.sin(a) * d / 2 * k]; i ? sh.lineTo(...p) : sh.moveTo(...p); } sh.closePath(); return sh; };
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x6a58b0, roughness: 0.95, flatShading: true });
    const rock = new THREE.Mesh(new THREE.ExtrudeGeometry(blob(1), { depth, bevelEnabled: true, bevelSize: 0.45, bevelThickness: 0.5, bevelSegments: 2 }), rockMat);
    rock.rotation.x = Math.PI / 2; rock.position.y = -0.5 + 0.02; rock.receiveShadow = true; rock.castShadow = true; g.add(rock);
    seed = 7;
    const top = new THREE.Mesh(new THREE.ShapeGeometry(blob(0.985)), new THREE.MeshStandardMaterial({ color: 0x5aa84d, roughness: 0.9, flatShading: true }));
    top.rotation.x = -Math.PI / 2; top.position.y = 0.04; top.receiveShadow = true; g.add(top);
    for (const [x, z, r, h] of [[0, 0, Math.min(w, d) * 0.42, depth + 4.5], [-w * 0.28, d * 0.1, d * 0.3, depth + 2.5], [w * 0.3, -d * 0.1, d * 0.28, depth + 3]]) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), rockMat);
      c.rotation.x = Math.PI; c.position.set(x, -h / 2 - 0.3, z); c.castShadow = true; g.add(c);
    }
    scene.add(g);
    window.__slab = g;
    const jg = new THREE.Group(); jg.name = "slab-jacks";
    // (slab.jacks: [[x share of w, z share of d, r, seed]]; none for the normal look)
    const jacks = S.float.slab.jacks ?? [[-0.4, 0.22, 0.34, 11], [0.41, -0.1, 0.3, 12], [0.08, 0.36, 0.26, 13]];
    for (const [kx, kz, r, seed] of jacks) {
      const one = new THREE.Group(); one.userData.at = [w * kx, d * kz]; one.userData.r = r; jack(one, 0, 0, 0, r, 0, seed); jg.add(one);
    }
    scene.add(jg);
    window.__slabJacks = jg;
  }
  // jack-o'-lanterns on the ground, glowing
  for (const [i, p] of (S.pumpkins || []).entries()) {
    const [x, z, r, face] = p, y = groundAt(x, z);
    const pc = J.jackPieces(x, y, z, { r, face, seed: i + 3 });
    const add = (geo, mat) => { if (!geo) return; const m = new THREE.Mesh(geo, mat); m.castShadow = true; scene.add(m); };
    add(pc.body, new THREE.MeshStandardMaterial({ color: pc.hue, roughness: 0.6 }));
    add(pc.stem, new THREE.MeshStandardMaterial({ color: 0x4a5a22, roughness: 0.9 }));
    add(pc.carve, new THREE.MeshBasicMaterial({ map: carve, transparent: true, color: 0xffb040, toneMapped: false }));
    const l = new THREE.PointLight(0xff8a2a, (S.pumpkinLight ?? 1.2) * r / 0.3, 14 * r, 1.8); l.position.set(x, y + r, z); scene.add(l);
  }

  // the C-130 squadron model, banking over the island
  if (S.c130) {
    const BP = await need("/maps/battlefield-props.js");
    const tpl = await BP.loadModel("c130");
    for (const [x, y, z, yaw, s] of S.c130) {
      const p = tpl.clone(true);
      p.position.set(x, y, z); p.rotation.set(0, yaw, -0.12); p.scale.setScalar(s || 1);
      (window.__planes ||= []).push(p);
      scene.add(p);
    }
  }
  // a harvest moon over the island: an orange disc with a soft halo
  if (S.moon) {
    const [x, y, z, r] = S.moon;
    // a flat disc that always faces the camera (a sphere near the edge of a
    // wide frame smears into an oval): a soft-limbed harvest moon with a few
    // darker seas, drawn on a canvas
    const mc = document.createElement("canvas"); mc.width = mc.height = 512;
    const mg = mc.getContext("2d");
    const body = mg.createRadialGradient(230, 220, 40, 256, 256, 250);
    body.addColorStop(0, "#ffe2a8"); body.addColorStop(0.7, "#ffc27a"); body.addColorStop(0.97, "#f2a35a"); body.addColorStop(1, "rgba(242,163,90,0)");
    mg.fillStyle = body; mg.beginPath(); mg.arc(256, 256, 250, 0, Math.PI * 2); mg.fill();
    mg.fillStyle = "rgba(196,120,60,0.22)";
    for (const [cx, cy, cr] of [[200, 190, 58], [310, 250, 44], [240, 320, 36], [330, 170, 26], [170, 290, 22]]) { mg.beginPath(); mg.arc(cx, cy, cr, 0, Math.PI * 2); mg.fill(); }
    const disc = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(mc), transparent: true, depthWrite: false, fog: false, toneMapped: false }));
    disc.userData.r = r;
    disc.renderOrder = 2;   // (over its own halo: both are sprites at one point)
    disc.scale.setScalar(r * 2);
    disc.position.set(x, y, z); scene.add(disc);
    window.__moon = [disc];
    const c = document.createElement("canvas"); c.width = c.height = 256;
    const g = c.getContext("2d"), grad = g.createRadialGradient(128, 128, 30, 128, 128, 128);
    grad.addColorStop(0, "rgba(255,170,90,0.55)"); grad.addColorStop(0.45, "rgba(255,120,60,0.18)"); grad.addColorStop(1, "rgba(255,90,40,0)");
    g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, fog: false, toneMapped: false }));
    halo.position.set(x, y, z); halo.scale.setScalar(r * 5); scene.add(halo);
    window.__moon.push(halo);
  }
  // a scorestreak drone hanging off the squad's shoulder
  if (S.drone) {
    const D = await need("/streaks/dragonfire-drone.js");
    const d = D.buildDragonfireModel().root;
    const [x, y, z, yaw, s] = S.drone;
    d.position.set(x, y, z); d.rotation.y = yaw; d.scale.setScalar(s || 1);
    scene.add(d);
  }
  console.log("ART staged");
}, SCENE);

async function render(cam, w, h) {
  return page.evaluate(async ({ v, w, h }) => {
    const T = window.__trollOps, THREE = T.THREE, R = T.renderer, Cm = T.composer, cam = T.camera;
    for (const rt of [Cm.renderTarget1, Cm.renderTarget2]) if (rt.samples !== 4) { rt.samples = 4; rt.dispose(); }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return await new Promise((done) => requestAnimationFrame(() => {
      cam.fov = v[6]; cam.aspect = w / h; cam.near = 0.05; cam.far = 3000;
      cam.position.set(v[0], v[1], v[2]); cam.lookAt(v[3], v[4], v[5]);
      cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
      R.setPixelRatio(1); R.setSize(w, h, false);
      Cm.setPixelRatio?.(1); Cm.setSize(w, h);
      for (const p of Cm.passes) for (const k of ["uHitFlash", "uLowHp", "uAberration", "uSuppress"]) if (p.uniforms?.[k]) p.uniforms[k].value = 0;
      Cm.render(0.016);
      // where the moving parts sit in this picture (boot-screen.js lays its
      // glows, the plane and the bats on these): shares of width and height,
      // a radius as a share of height. Taken here, in the frame that drew
      // the picture: the game's own loop puts the player's camera back a
      // frame later.
      const P = new THREE.Vector3(), Q = new THREE.Vector3(), tanH = Math.tan(cam.fov * Math.PI / 360);
      const at = (o, r = 0) => {
        o.getWorldPosition(P);
        const d = P.distanceTo(cam.position);
        Q.copy(P).project(cam);
        return { x: +((Q.x + 1) / 2).toFixed(4), y: +((1 - Q.y) / 2).toFixed(4), r: +(r / (d * tanH) / 2).toFixed(4) };
      };
      const anchors = { jacks: [] };
      if (window.__moon?.[0]) anchors.moon = at(window.__moon[0], window.__moon[0].userData.r ?? window.__moon[0].geometry?.parameters?.radius ?? 0);
      for (const one of window.__slabJacks?.children || []) anchors.jacks.push(at(one, one.userData.r || 0.3));
      if (window.__planes?.[0]) { const b = new THREE.Box3().setFromObject(window.__planes[0]); anchors.plane = at(window.__planes[0], b.getSize(new THREE.Vector3()).length() / 2); }
      done({ url: R.domElement.toDataURL("image/png"), anchors });
    }));
  }, { v: cam, w, h });
}
/* The tall frame sometimes comes back blank (a white or empty canvas at its
   size); a tiny data URL gives it away. Three goes, a moment apart. */
async function renderSure(cam, w, h) {
  let out = null;
  for (let i = 0; i < 3; i++) {
    out = await render(cam, w, h);
    if (out.url.length > w * h * 0.15) return out;
    console.log(`ART blank frame at ${w}x${h} (${out.url.length} chars), again`);
    await new Promise((r) => setTimeout(r, 1500));
  }
  return out;
}
const save = (file, data) => fs.writeFileSync(file, Buffer.from(data.split(",")[1], "base64"));
const anchors = {};

for (const [name, frame] of Object.entries(SCENE.frames)) {
  if (process.env.FRAMES && !process.env.FRAMES.split(",").includes(name)) continue;   // FRAMES=tall: just that one
  const cams = TRY ? frame.cams : [frame.cams[0]];
  for (const [i, cam] of cams.entries()) {
    // the finals render at 2x and come down with lanczos: clean edges
    // (the tall one at 2x, 2160 x 3840, came back white: its own `ss`)
    const k = TRY ? 0.4 : (frame.ss ?? 2);
    // the moon and the plane placed for this framing (clear of the wordmark)
    if (frame.place) await page.evaluate((p) => {
      if (p.moon) for (const o of window.__moon || []) o.position.set(...p.moon);
      if (p.c130) for (const o of window.__planes || []) o.position.set(...p.c130);
    }, frame.place);
    if (SCENE.float) await page.evaluate(({ v, C }) => {
      const THREE = window.__trollOps.THREE;
      const pos = new THREE.Vector3(v[0], v[1], v[2]), fwd = new THREE.Vector3(v[3] - v[0], 0, v[5] - v[2]).normalize();
      const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0));
      const yaw = Math.atan2(-fwd.x, -fwd.z);
      for (const { g, m } of window.__cast || []) {
        g.position.copy(pos).addScaledVector(fwd, C.dist + (m.back || 0)).addScaledVector(right, (m.side || 0) * (C.spread ?? 1));
        g.position.y += C.feet + (m.up || 0);
        g.rotation.y = yaw;
        g.scale.setScalar(C.scale ?? 1);
      }
      const slab = window.__slab;
      if (slab) {
        slab.position.copy(pos).addScaledVector(fwd, C.dist + (C.slabBack || 0)); slab.position.y += C.feet;
        slab.rotation.y = yaw; slab.scale.set(C.slabScale ?? 1, 1, 1);
        const jg = window.__slabJacks;
        jg.position.copy(slab.position); jg.rotation.y = yaw;
        for (const one of jg.children) one.position.set(one.userData.at[0] * (C.slabScale ?? 1), 0, one.userData.at[1]);
      }
    }, { v: cam, C: frame.cast || {} });
    // (the plane is the boot screen's own moving sprite, below: the picture
    // goes without it; its anchor is still taken from where it would be)
    if (!TRY) await page.evaluate(() => { for (const o of window.__planes || []) o.visible = false; });
    const shot = await renderSure(cam, Math.round(frame.size[0] * k), Math.round(frame.size[1] * k));
    const url = shot.url;
    anchors[name] = shot.anchors;
    await page.evaluate(() => { for (const o of window.__planes || []) o.visible = true; });
    const file = TRY ? path.join(TRYDIR, `${name}-${i}.png`) : path.join(TRYDIR, `${name}-2x.png`);
    save(file, url);
    console.log("wrote", file);
    if (TRY) continue;
    const out = frame.out || frame.size;
    const scale = `scale=${out[0]}:${out[1]}:flags=lanczos`;
    execFileSync(process.env.FFMPEG || "ffmpeg", ["-loglevel", "error", "-y", "-i", file, "-vf", scale, path.join(TRYDIR, `${name}.png`)]);
    // webp q 92: sharp on a phone's screen, still a few hundred KB
    const webp = path.join(OUT, `key-art-${name}${SCENE.suffix || ""}.webp`);
    execFileSync(process.env.FFMPEG || "ffmpeg", ["-loglevel", "error", "-y", "-i", file, "-vf", scale, "-c:v", "libwebp", "-quality", "92", "-compression_level", "6", webp]);
    console.log("wrote", path.relative(ROOT, webp), Math.round(fs.statSync(webp).size / 1024), "KB");
  }
}
if (!TRY) {
  // the plane alone, on a clear background: the boot screen flies it across
  // the sky (one sprite per look: the light differs)
  const sprite = await page.evaluate(async () => {
    const T = window.__trollOps, THREE = T.THREE, R = T.renderer, cam = T.camera, scene = T.scene;
    const plane = window.__planes?.[0];
    if (!plane) return null;
    const inPlane = new Set(); plane.traverse((o) => inPlane.add(o));
    const hid = [];
    scene.traverse((o) => { if (o !== scene && o.visible && !o.isLight && !inPlane.has(o) && o.parent === scene) { hid.push(o); o.visible = false; } });
    // (the plane's own ancestors stay; anything else at the top level is hidden)
    for (let a = plane.parent; a && a !== scene; a = a.parent) { a.visible = true; const i = hid.indexOf(a); if (i >= 0) hid.splice(i, 1); }
    if (plane.parent !== scene) for (const o of plane.parent.children) if (!inPlane.has(o) && o.visible && !o.isLight) { hid.push(o); o.visible = false; }
    const b = new THREE.Box3().setFromObject(plane), c = b.getCenter(new THREE.Vector3()), r = b.getSize(new THREE.Vector3()).length() / 2;
    const d = cam.position.distanceTo(c);
    cam.fov = 2 * Math.atan(r * 1.05 / d) * 180 / Math.PI; cam.aspect = 2; cam.updateProjectionMatrix();
    cam.lookAt(c); cam.updateMatrixWorld(true);
    const fog = scene.fog; scene.fog = null;
    const bg = scene.background; scene.background = null;
    R.setPixelRatio(1); R.setSize(1024, 512, false);
    R.setClearColor(0x000000, 0); R.autoClear = true;
    R.render(scene, cam);
    const url = R.domElement.toDataURL("image/png");
    scene.fog = fog; scene.background = bg;
    for (const o of hid) o.visible = true;
    return url;
  });
  if (sprite) {
    const png = path.join(TRYDIR, `plane${SCENE.suffix || ""}.png`);
    save(png, sprite);
    const webp = path.join(OUT, `plane${SCENE.suffix || ""}.webp`);
    execFileSync(process.env.FFMPEG || "ffmpeg", ["-loglevel", "error", "-y", "-i", png, "-c:v", "libwebp", "-quality", "90", "-pix_fmt", "yuva420p", webp]);
    console.log("wrote", path.relative(ROOT, webp), Math.round(fs.statSync(webp).size / 1024), "KB");
  }
  // the anchors, this look's merged over the other's
  const file = path.join(OUT, "key-art-anchors.json");
  let all = {};
  try { all = JSON.parse(fs.readFileSync(file, "utf8")); } catch {}
  all[SCENE.suffix ? SCENE.suffix.slice(1) : "normal"] = anchors;
  fs.writeFileSync(file, JSON.stringify(all) + "\n");
  console.log("wrote", path.relative(ROOT, file));
}
await browser.close();
server.close();
