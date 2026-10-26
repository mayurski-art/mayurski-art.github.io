// Trollface Island's build video (user, 2026-10-25: "i want the timelapse to
// look like the place was being upgraded in real time but fast forward. And
// showing various angles close up and far sighted. The entire video so all
// phases combined should be 40 seconds long", then 2026-10-26: "make it a 1
// minute video actually", better angles, no hand-drawn grins); "i dont want to see any texts
// in the video" other than the phase number and its goal, at the bottom of
// the frame, in the font of the game's place titles, Georgia).
//
// Loads the island as it stood after each phase (served straight out of git,
// no checkout), and in each films that phase's new pieces rising out of the
// ground place by place (a clipping plane climbs each place from its foot
// to its top), a wide shot of the island while the phase's other places go
// up, then a close fly-by of its hero place going up; the bake fades its
// light in; the last state orbits. Frames go through the game's own post
// chain at 1080p, 30 fps; ffmpeg cuts them into one mp4 with the caption.
//
//   NODE_PATH=<main checkout>/node_modules node tools/troll-ops-island-buildvideo.mjs [--only N] [--out file.mp4]
//
// Royale mode, no bots, no drop, graphics High, the zone and loot hidden;
// Supabase blocked (never a public room). FFMPEG=<path> if ffmpeg isn't on
// PATH; FONT=<ttf> for the caption (default Georgia).

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execFileSync, spawn } from "node:child_process";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (k, d = null) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const FFMPEG = process.env.FFMPEG || "ffmpeg";
const FONT = (process.env.FONT || "C:/Windows/Fonts/georgia.ttf").replace(/\\/g, "/");
const W = 1920, H = 1080, FPS = 30;
const common = execFileSync("git", ["rev-parse", "--git-common-dir"], { cwd: ROOT, encoding: "utf8" }).trim();
const MAIN = path.resolve(ROOT, common, "..");
const DIR = path.join(MAIN, ".claude/island-timelapse/build");
const OUT = opt("--out", path.join(MAIN, ".claude/island-timelapse/island-build.mp4"));

// The island after each phase: the commit, its caption (the phase and its
// goal), its seconds, the places it rebuilt (they rise; the models it
// spread over the whole island fade in), its hero place (the close shot),
// the wide shot's centre, radius and height. Phase 0 (the builder) changed
// nothing on screen.
const STATES = [
  { sha: "21ff7ed8", caption: "Phase 0: the bare island",
    sub: "The ground, the lake and the coastline, and the Blender pipeline\nthat builds every place from here on.",
    secs: 3, wide: [0, 0, 290, 175], moves: [{ p: [60, 360, 420], t: [20, 0, 0], fov: 44 }, { p: [35, 175, 235], t: [20, 0, -5], fov: 46 }] },
  { sha: "47d672e1", caption: "Phase 1: Troll City and Troll Peak",
    sub: "The island's first two places go up: Troll City round its fountain plaza and blue tower,\nand Troll Peak, the island's high point, with its hut on the summit.",
    secs: 9, rise: ["city", "peak"], hero: "city", azA: 0.55, azB: 0.35, wide: [10, -65, 150, 95] },
  { sha: "e35870b8", caption: "Phase 2: the Skate Bowl and the Portal",
    sub: "The east side fills in: the Skate Bowl's ramps and floor,\nand the Portal standing beside it.",
    secs: 9, rise: ["skate", "portal"], hero: "skate", azA: 1.75, azB: -1.0, wide: [125, -80, 120, 80] },
  { sha: "88efa3cb", caption: "Phase 3: the lake, its five places and the roads",
    sub: "The Cave, the Dock, Old Tree, the Bridge and the Boat go up round the lake;\nroads now join every place, and the coast closes the island.",
    secs: 9, rise: ["cave", "dock", "tree", "boat", "bridge"], fade: ["roads", "coast"], hero: "boat", azA: -0.75, azB: -0.85, wide: [20, 0, 210, 140] },
  { sha: "bd8e7612", caption: "Phase 4: the Shop, Marketplace, Gallery, Meme Lab and Observatory",
    sub: "Five places fill the middle of the island: more buildings to loot,\nmore cover to fight from, and somewhere at the end of every road.",
    secs: 9, rise: ["shop", "memelab", "gallery", "observatory", "market"], hero: "market", azA: 1.9, azB: -2.3, wide: [20, 10, 230, 150] },
  { sha: opt("--p5", "HEAD"), caption: "Phase 5: Rage Ranch, Lulz Lodge, Lighthouse Point, Problem Plant, Grin Gas",
    sub: "Five new places out by the coast: the island's 19 places are all in,\nwith their loot and the zone's phases re-laid round them.",
    secs: 9, rise: ["ranch", "lodge", "light", "plant", "gas"], hero: "ranch", azA: -2.6, azB: 0.9, wide: [0, 0, 270, 170] },
  { sha: opt("--p6", "HEAD"), caption: "Phase 6: sunlight and shadows baked in",
    sub: "Light maps bake the sun, the sky and the bounced light into every place:\nbrighter outside, darker indoors, and no slower to run.",
    secs: 5, bake: true, wide: [0, 0, 250, 150], moves: [{ p: [-45, 22, 112], t: [-30, 12, -70], fov: 52 }, { p: [22, 28, 106], t: [0, 14, -75], fov: 52 }] },
  { sha: opt("--p7", "HEAD"), caption: "Phase 7: the Boat sets sail",
    sub: "The Boat sails round the whole lake under arched boardwalks, with you aboard;\nthe flickering roads and fountains are fixed, and every test passes.",
    secs: 7, orbit: { c: [45, 25], r: 150, a: [2.3, 3.25], h: [72, 52], t: [35, 0, 5] }, wide: [0, 0, 230, 120] },
];
// the places' centres and rings (models/trollface-island-layout.json): the
// camera's moves are laid round them
const PLACES = {
  memelab: [-127.1, -114, 14], city: [-36.3, -86.9, 40], observatory: [81.7, -99.5, 13], portal: [120.8, -100.6, 19],
  skate: [131.7, -61.5, 36], peak: [56.8, -43.4, 33], cave: [-9.1, -32.6, 17], dock: [-104.4, -34.4, 7], tree: [-74.5, -46.3, 8],
  boat: [99.9, 16.3, 9], gallery: [-99, 45.3, 19], shop: [38.6, 77.8, 19], market: [145.3, 97.7, 26], bridge: [-28.6, 77.8, 6],
  ranch: [-180, -45, 39], lodge: [-145, 5, 31], light: [160, 20, 18], plant: [35, -130, 30], gas: [85, 125, 21],
};
const along = (a, d) => [Math.sin(a) * d, Math.cos(a) * d];
/* The wide shot: a crane that pushes in over the phase's part of the island
   from azA, the horizon and the sky beyond it. */
function wideMoves(state) {
  const ps = (state.rise || []).map((k) => PLACES[k]);
  const cx = ps.reduce((a, p) => a + p[0], 0) / ps.length, cz = ps.reduce((a, p) => a + p[1], 0) / ps.length;
  const R = Math.max(...ps.map((p) => Math.hypot(p[0] - cx, p[1] - cz) + p[2])) + 25;
  const [sx, sz] = along(state.azA, R * 1.3), [ex, ez] = along(state.azA + 0.38, R * 0.92);
  return [{ p: [cx + sx, R * 0.55, cz + sz], t: [cx, 0, cz], fov: 50 }, { p: [cx + ex, R * 0.33, cz + ez], t: [cx, 4, cz], fov: 50 }];
}
/* The close shot: a low dolly round the hero place from azB, tilting up as
   it rises out of the ground (`top`: how tall it stands). */
function heroMoves(state, top) {
  const [x, z, r] = PLACES[state.hero];
  // turned on from azB till neither end stands in another place's ring
  const clear = (px, pz) => Object.entries(PLACES).every(([k, [qx, qz, qr]]) => k === state.hero || Math.hypot(px - qx, pz - qz) > qr + 8);
  let az = state.azB;
  for (let k = 0; k < 24; k++, az += 0.26) {
    const [sx, sz] = along(az, r * 1.55 + 12), [ex, ez] = along(az + 0.6, r * 1.45 + 12);
    if (k < 23 && !(clear(x + sx, z + sz) && clear(x + ex, z + ez))) continue;
    return [{ p: [x + sx, 10, z + sz], t: [x, top * 0.2, z], fov: 58 }, { p: [x + ex, 12 + top * 0.3, z + ez], t: [x, top * 0.5, z], fov: 54 }];
  }
}
const mix = (a, b, u) => a + (b - a) * u;
const camAt = ([m0, m1], u) => [...m0.p.map((v, i) => mix(v, m1.p[i], u)), ...m0.t.map((v, i) => mix(v, m1.t[i], u)), mix(m0.fov, m1.fov, u)];
const total = STATES.reduce((s, st) => s + st.secs, 0);
if (Math.abs(total - 60) > 0.01) throw new Error(`the states add up to ${total} s, not 60`);   // (user, 2026-10-26: a minute)

// ---- git as a file server: `git cat-file --batch`, one request at a time
class GitFiles {
  constructor(cwd) {
    this.p = spawn("git", ["cat-file", "--batch"], { cwd });
    this.buf = Buffer.alloc(0);
    this.queue = [];
    this.p.stdout.on("data", (d) => { this.buf = Buffer.concat([this.buf, d]); this.pump(); });
  }
  get(spec) {
    return new Promise((resolve) => { this.queue.push({ spec, resolve, sent: false }); this.kick(); });
  }
  kick() {
    const q = this.queue[0];
    if (q && !q.sent) { q.sent = true; this.p.stdin.write(q.spec + "\n"); }
  }
  pump() {
    const q = this.queue[0];
    if (!q) return;
    const nl = this.buf.indexOf(10);
    if (nl < 0) return;
    const head = this.buf.subarray(0, nl).toString();
    if (head.endsWith("missing") || head.endsWith("ambiguous")) {
      this.buf = this.buf.subarray(nl + 1); this.queue.shift(); q.resolve(null); this.kick(); this.pump(); return;
    }
    const size = +head.split(" ")[2];
    if (this.buf.length < nl + 1 + size + 1) return;
    const body = this.buf.subarray(nl + 1, nl + 1 + size);
    this.buf = this.buf.subarray(nl + 1 + size + 1);
    this.queue.shift(); q.resolve(Buffer.from(body)); this.kick(); this.pump();
  }
  close() { this.p.stdin.end(); }
}

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg", ".wasm": "application/wasm" };

async function film(state, index, files, frames0) {
  const sha = execFileSync("git", ["rev-parse", state.sha], { cwd: ROOT, encoding: "utf8" }).trim();
  const server = http.createServer(async (req, res) => {
    let rel = decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, "");
    if (!rel || rel.endsWith("/")) rel += "index.html";
    const body = await files.get(`${sha}:${rel}`);
    if (!body) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": TYPES[path.extname(rel)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(body);
  });
  await new Promise((r) => server.listen(0, r));
  const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.route(/supabase/, (r) => r.abort());
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("ERR", e.message));
  await page.goto(`http://localhost:${server.address().port}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 180000 });
  await page.evaluate(async () => {
    const T = window.__trollOps;
    T.DROP.enabled = false; T.settings.gfx = "high"; T.setMode("royale");
    if (T.els.noBots) T.els.noBots.checked = true;
    T.loadout.mapId = "trollface";
    await T.startGame(); if (T.isStaging()) T.endStaging();
  });
  await page.waitForLoadState("networkidle", { timeout: 240000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, +(process.env.WAIT || 15000)));
  // the pieces this phase rebuilt, by the model they belong to (tf-<place>-pN,
  // the trollhead faces and the Gallery's bust with their places)
  const groups = await page.evaluate(async (state) => {
    const T = window.__trollOps, THREE = await import("three");
    T.renderer.localClippingEnabled = true;
    // (the old commits' hand-drawn grin: the user had it removed from the game,
    // so it is out of the video too. Its plaza decals go; the Peak hut's window
    // and the blue tower's mosaic get the real trollface art, as now)
    const art = new THREE.TextureLoader().load("/assets/images/wallpaper/trollface%20transparent.png");
    art.colorSpace = THREE.SRGBColorSpace;
    T.scene.traverse((o) => {
      const m = o.isMesh && o.material;
      if (!m?.isMeshBasicMaterial || !m.map?.isCanvasTexture || m.map.image?.width !== 256 || Math.abs(m.opacity - 0.85) > 1e-3) return;
      const g = o.geometry, pos = g.attributes.position, idx = g.index ? [...g.index.array] : [...Array(pos.count).keys()];
      const keep = [];
      for (let i = 0; i < idx.length; i += 3) if (![0, 1, 2].every((j) => pos.getY(idx[i + j]) < 0.3)) keep.push(idx[i], idx[i + 1], idx[i + 2]);
      g.setIndex(keep);
      o.material = new THREE.MeshBasicMaterial({ map: art, transparent: true, depthWrite: false, side: m.side });
    });
    const placeOf = (name) => {
      if (name === "hg-trollbust") return "gallery";
      const m = /^tf-([a-z]+?)(face)?(-p\d)?$/.exec(name || "");
      return m && m[1];
    };
    const box = new THREE.Box3();
    const anim = { groups: {}, fades: [], bake: [] };
    T.scene.updateMatrixWorld(true);
    T.scene.traverse((o) => {
      if (!o.isMesh) return;
      if (state.bake) for (const mat of [].concat(o.material)) if (mat.lightMap) anim.bake.push([mat, mat.lightMapIntensity]);
      let a = o;
      while (a && !a.userData.model) a = a.parent;
      const place = a && placeOf(a.userData.model);
      if (!place) return;
      const fade = (state.fade || []).includes(place), rise = (state.rise || []).includes(place);
      if (!fade && !rise) return;
      const mats = [].concat(o.material).map((mat) => mat.clone());
      o.material = Array.isArray(o.material) ? mats : mats[0];
      if (fade) {
        for (const mat of mats) { mat.userData.opacity = mat.opacity; mat.transparent = true; mat.opacity = 0; }
        anim.fades.push(mats);
        return;
      }
      box.setFromObject(o);
      const g = anim.groups[place] || (anim.groups[place] = { lo: Infinity, hi: -Infinity, plane: new THREE.Plane(new THREE.Vector3(0, -1, 0), -1e3) });
      g.lo = Math.min(g.lo, box.min.y); g.hi = Math.max(g.hi, box.max.y);
      for (const mat of mats) { mat.clippingPlanes = [g.plane]; mat.clipShadows = true; mat.needsUpdate = true; }
    });
    window.__tfBuild = anim;
    return Object.fromEntries(Object.entries(anim.groups).map(([k, g]) => [k, [g.lo, g.hi]]));
  }, state);
  console.log(`state ${index} (${state.sha} ${sha.slice(0, 8)}): rising ${Object.keys(groups).join(" ") || "-"}; fading ${(state.fade || []).join(" ") || "-"}`);

  // the schedule: shot A (wide) builds every group but the hero's, shot B (close) the hero's
  const n = Math.round(state.secs * FPS);
  const nA = state.hero ? Math.round(n * 0.52) : n;
  const others = Object.keys(groups).filter((k) => k !== state.hero);
  const plan = {};
  others.forEach((k, i) => {
    const span = 0.8 / Math.max(1, others.length);
    plan[k] = [(0.06 + i * span * 0.85) * nA, (0.06 + i * span * 0.85 + span * 1.4) * nA];
  });
  if (state.hero && groups[state.hero]) plan[state.hero] = [nA + (n - nA) * 0.05, nA + (n - nA) * 0.85];
  const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  for (let f = 0; f < n; f++) {
    const t = f / n;
    let cam;
    if (state.orbit) {
      // the finale: round the lake, coming down, the Boat sailing
      const o = state.orbit, u = ease(f / n) * 0.85 + (f / n) * 0.15, a = mix(o.a[0], o.a[1], u);
      cam = [o.c[0] + Math.sin(a) * o.r, mix(o.h[0], o.h[1], u), o.c[1] + Math.cos(a) * o.r, ...o.t, 48];
    } else if (state.moves) cam = camAt(state.moves, ease(f / n));
    else if (f < nA || !state.hero) cam = camAt(wideMoves(state), ease(f / nA));
    else cam = camAt(heroMoves(state, Math.max(4, groups[state.hero]?.[1] || 10)), ease((f - nA) / (n - nA)));
    const levels = {};
    for (const [k, [lo, hi]] of Object.entries(groups)) {
      const [f0, f1] = plan[k] || [0, 1];
      levels[k] = lo - 0.2 + (hi - lo + 0.6) * ease((f - f0) / (f1 - f0));
    }
    const fade = ease(f / (nA * 0.6));
    const bakeK = state.bake ? ease((f - n * 0.15) / (n * 0.6)) : 1;
    const url = await page.evaluate(async ([cam, levels, fade, bakeK, W, H]) => {
      const T = window.__trollOps, R = T.renderer, C = T.composer, c = T.camera, A = window.__tfBuild;
      for (const rt of [C.renderTarget1, C.renderTarget2]) if (rt.samples !== 4) { rt.samples = 4; rt.dispose(); }
      return await new Promise((done) => requestAnimationFrame(() => {
        for (const [k, g] of Object.entries(A.groups)) g.plane.constant = levels[k];
        for (const mats of A.fades) for (const m of mats) { m.opacity = m.userData.opacity * fade; m.transparent = fade < 1; }
        for (const [m, full] of A.bake) m.lightMapIntensity = full * bakeK;
        c.fov = cam[6]; c.aspect = W / H; c.near = 0.1; c.far = 2000;
        c.position.set(cam[0], cam[1], cam[2]); c.lookAt(cam[3], cam[4], cam[5]);
        c.updateProjectionMatrix(); c.updateMatrixWorld(true);
        R.setPixelRatio(1); R.setSize(W, H, false);
        C.setPixelRatio?.(1); C.setSize(W, H);
        for (const p of C.passes) for (const k of ["uHitFlash", "uLowHp", "uAberration", "uSuppress"]) if (p.uniforms?.[k]) p.uniforms[k].value = 0;
        for (const p of C.passes) if (p.constructor.name === "ViewmodelPass") p.enabled = false;
        const roy = T.royale?.();
        if (roy) {
          if (roy.visual?.group) roy.visual.group.visible = false;
          for (const m of [roy.loot?.beams, roy.loot?.rings]) if (m) m.visible = false;
          for (const it of roy.loot?.items?.values?.() || []) if (it.mesh) it.mesh.visible = false;
        }
        C.render(1 / 30);
        done(R.domElement.toDataURL("image/jpeg", 0.93));
      }));
    }, [cam, levels, fade, bakeK, W, H]);
    fs.writeFileSync(path.join(DIR, `${String(frames0 + f).padStart(5, "0")}.jpg`), Buffer.from(url.split(",")[1], "base64"));
  }
  await browser.close(); server.close();
  return n;
}

fs.mkdirSync(DIR, { recursive: true });
const only = opt("--only");
const cutOnly = process.argv.includes("--cut");   // re-cut the video from the frames already filmed
if (only == null && !cutOnly) for (const f of fs.readdirSync(DIR)) if (f.endsWith(".jpg")) fs.unlinkSync(path.join(DIR, f));
const files = new GitFiles(ROOT);
let frame = 0;
const marks = [];
for (let i = 0; i < STATES.length; i++) {
  const n = Math.round(STATES[i].secs * FPS);
  if (cutOnly || (only != null && +only !== i)) { marks.push([frame, n]); frame += n; continue; }
  await film(STATES[i], i, files, frame);
  marks.push([frame, n]);
  frame += n;
}
files.close();
if (only != null) { console.log(`state ${only} filmed (frames in ${DIR}); run without --only for the video`); process.exit(0); }
// the captions: each phase's title and, under it, its subheader (what it built
// and improved, user, 2026-10-26), faded in and out, at the bottom, in Georgia,
// on dark boxes so they read over the busy island
const SUB_TOP = 150;     // px from the bottom to the subheader's two lines
const esc = (s) => s.replace(/\\/g, "\\\\").replace(/'/g, "\u2019").replace(/:/g, "\\:");
const draws = STATES.map((st, i) => {
  if (!st.caption) return null;
  const t0 = marks[i][0] / FPS, t1 = (marks[i][0] + marks[i][1]) / FPS;
  const alpha = `if(lt(t,${t0 + 0.35}),(t-${t0})/0.35,if(gt(t,${t1 - 0.35}),(${t1}-t)/0.35,1))`;
  const font = `fontfile='${FONT.replace(/:/g, "\\:")}'`;
  const on = `shadowcolor=black@0.55:shadowx=0:shadowy=2:box=1:boxcolor=black@0.4:enable='between(t,${t0},${t1})':alpha='${alpha}'`;
  return [
    `drawtext=${font}:text='${esc(st.caption)}':fontcolor=0xfff4e2:fontsize=50:boxborderw=18:${on}:x=(w-text_w)/2:y=h-${SUB_TOP + 46}-text_h`,
    `drawtext=${font}:text='${esc(st.sub)}':fontcolor=0xe8dcc8:fontsize=31:line_spacing=10:text_align=C:boxborderw=14:${on}:x=(w-text_w)/2:y=h-${SUB_TOP}`,
  ].join(",");
}).filter(Boolean).join(",");
// and a copy with no text at all, to caption again elsewhere (user, 2026-10-26:
// "you could make the video without the texts incase i want to change it")
const CLEAN = OUT.replace(/\.mp4$/, "") + "-no-text.mp4";
for (const [vf, out] of [[`${draws},format=yuv420p`, OUT], ["format=yuv420p", CLEAN]]) {
  execFileSync(FFMPEG, ["-loglevel", "error", "-y", "-framerate", String(FPS), "-i", path.join(DIR, "%05d.jpg"),
    "-vf", vf, "-c:v", "libx264", "-crf", "24", "-preset", "slow", "-movflags", "+faststart", out]);
}
console.log(`${frame} frames (${(frame / FPS).toFixed(1)} s) -> ${OUT}, ${CLEAN}`);
