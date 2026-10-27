// The Play tab's backdrop reel (menu/lobby-fn.js): more stills of each map
// and a clip of Kabukigrin's club, all through the game's own renderer and
// post chain.
//
//   shots [mapId ...]  two more stills per map (VIEWS below; the map vote's
//                      shot in ui/maps/ is the first), rendered at 2560x1440,
//                      encoded to ui/lobby/<id>-<n>-{1280,1920}.webp
//   clip club|screen   Kabukigrin in Socialize, the club full and its screens
//                      playing, filmed like a vlog (CLIPS below): stepped a
//                      frame at a time at 30 fps, encoded to
//                      ui/lobby/kabukigrin-<name>-{1280,1920}.{webm,mp4}
//
// TRY=1 renders every candidate in TRIES (and VIEWS) small to .claude/reel-try/
// for picking framings, and encodes nothing.
// Usage: NODE_PATH=<main checkout>/node_modules node tools/troll-ops-lobby-reel.mjs shots|clip
// FFMPEG=<path> if ffmpeg isn't on PATH; ANGLE=swiftshader without a GPU.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "assets/games/troll-ops/ui/lobby");
const MASTER = path.join(ROOT, ".claude/reel-hq");
const TRYDIR = path.join(ROOT, ".claude/reel-try");
const FFMPEG = process.env.FFMPEG || "ffmpeg";
const TRY = !!process.env.TRY;
for (const d of [OUT, MASTER, TRYDIR]) fs.mkdirSync(d, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".glb": "model/gltf-binary", ".mp3": "audio/mpeg", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp4": "video/mp4", ".webm": "video/webm" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  const type = TYPES[path.extname(p)] || "application/octet-stream", size = fs.statSync(p).size;
  // byte ranges: a video only seeks with them (every seek lands on 0 without)
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || "");
  if (m) {
    const a = m[1] ? +m[1] : 0, b = m[2] ? Math.min(+m[2], size - 1) : size - 1;
    res.writeHead(206, { "content-type": type, "content-range": `bytes ${a}-${b}/${size}`, "accept-ranges": "bytes", "content-length": b - a + 1 });
    return fs.createReadStream(p, { start: a, end: b }).pipe(res);
  }
  res.writeHead(200, { "content-type": type, "accept-ranges": "bytes", "content-length": size });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;

// [camera x, y, z, look-at x, y, z, fov]: three per map (Kabukigrin: two, its
// map-vote still and the club clips make up the rest), picked off contact
// sheets of 24 (8 directions x close, street and mid height) for the look
const VIEWS = {
  grinsite: [[13, 2.4, 13, -4, 1.3, -4, 66], [-4, 2.4, 20, -4, 1.3, -4, 66], [34.5, 8, -4, -4, 0, -4, 58]],   // the stairs and pipes up close, the frame and the crane, the container yard
  undergrin: [[1, 9.8, -3.6, 1, 8.8, -16, 66], [1, 9.8, -28.4, 1, 8.8, -16, 66], [-13, 9.6, -2, 1, 7.6, -16, 58]],   // the arch under the departures clock, the escalator well, the poster wall
  dustbowl: [[-19.5, 2.7, -19.5, -2, 1.5, -2, 66], [15.5, 2.7, -19.5, -2, 1.5, -2, 66], [-30, 9, 26, -2, 0, -2, 58]],   // the minaret and palms, the lantern square, the market
  depot: [[13.2, 2.7, -6, 6, 2.9, -6, 62], [20.1, 3.2, 8.1, 6, 2.2, -6, 66], [-8.1, 3.2, 8.1, 6, 2.2, -6, 66]],   // the aisles under the work lights
  culdegrin: [[0, 1.7, -11.6, 0, 1.9, -4, 62], [0, 3.9, 17.1, 0, 2.1, -4, 66], [0, 13, 29.8, 0, 0, -4, 58]],   // the street at sunset down its centre line, the lamp, the road from above
  grinbeach: [[54.6, 4.5, -12, 26, 2.5, -12, 66], [-2.6, 4.5, -12, 26, 2.5, -12, 66], [58.4, 15, 20.4, 26, 0, -12, 58]],   // the courts up close, the lifeguard towers by the water, the courts and awnings
  hollowgrin: [[64.3, 4.7, -6, 74, 4.9, -6, 62], [55, 6.5, 13, 74, 4.9, -6, 66], [30.9, 14.5, -6, 74, 3, -6, 58]],   // the cotton candy under the wheel, the fountain, the carousel up close
  grinleria: [[-2.3, 3.7, 5.9, -6, 3.9, 2.2, 62], [8.4, 4.2, 2.2, -6, 3.2, 2.2, 66], [4.1, 4.2, -7.9, -6, 3.2, 2.2, 66]],   // the rink under the dome, the centre-ice trollface, the logo up close
  trollcity: [[57.3, 7.2, 0, 44, 7.4, 0, 62], [30.7, 7.2, 0, 44, 7.4, 0, 62], [7, 7.7, 0, 44, 6.7, 0, 66]],   // Main Street past the Grand Hotel, the hotel and the courthouse, Guns & Ammo
  trollface: [[166.4, 58, 20, 18, -5, 20, 50], [-86.9, 58, -84.9, 18, -5, 20, 50], [122.9, 58, -84.9, 18, -5, 20, 50]],   // low over the lake and the purple tower
  kabukigrin: [[12, 1.8, -40, 17, 4.8, -32, 72], [7.5, 1.6, -3, 23, 1.3, -3, 74]],   // Alta's DJ Lulz board, the yokocho (the club is the clip)
};
// candidates for TRY=1, per map
const TRIES = {
  grinsite: [[-50.5, 16, 8.2, -4, 0, -4, 55], [8.2, 16, -50.5, -4, 0, -4, 55], [-34.6, 12.8, -34.6, -4, 0, -4, 55], [0.4, 7.2, 19.6, -4, 0, -4, 63]],
  undergrin: [[-18.1, 8.2, -31.8, 1, 7.6, -16, 74], [24.2, 8.2, -24.9, 1, 7.6, -16, 74], [4.6, 8.1, -38.1, 1, 7.6, -16, 74], [-7.6, 7.9, -7, 1, 7.6, -16, 82]],
  dustbowl: [[-49.9, 18, 10.5, -2, 0, -2, 55], [10.5, 18, -49.9, -2, 0, -2, 55], [-33.5, 14.4, -33.5, -2, 0, -2, 55], [2.6, 8.1, 22.3, -2, 0, -2, 63]],
  depot: [[10, 4.5, -12, -20, 1, 12, 72], [-5, 6, 15, 10, 1, -15, 70], [15, 3, 10, -15, 2, -10, 72], [-20, 3, -10, 10, 1, 5, 72]],
  culdegrin: [[-38.3, 26, -21.8, 0, 0, -4, 55], [34.2, 26, -28.7, 0, 0, -4, 55], [-3.6, 20.8, -41.8, 0, 0, -4, 55], [-10.2, 11.7, 14.5, 0, 0, -4, 63]],
  grinbeach: [[-16.3, 30, -50.6, 26, 0, -12, 62], [80.4, 30, -29.9, 26, 0, -12, 62], [36.8, 24, -62.4, 26, 0, -12, 62], [5.2, 13.5, 7.7, 26, 0, -12, 70]],
  hollowgrin: [[57.6, 26, -57.3, 74, 3, -6, 62], [126.7, 26, 4.9, 74, 3, -6, 62], [106.4, 21.4, -42, 74, 3, -6, 62], [47.9, 13.4, 0.3, 74, 3, -6, 70]],
  grinleria: [[6, 8, 2, -30, 3, 2, 70], [-20, 8, 2, 10, 3, 2, 70], [-6, 9, 20, -6, 2, -10, 72], [-6, 9, -16, -6, 2, 10, 72]],
  trollcity: [[40, 4, 6, -20, 4, -2, 64], [10, 12, -10, -30, 2, 10, 64], [0, 3, 0, 40, 5, 0, 66], [20, 9, 14, 60, 3, -10, 64]],
  trollface: [[-165, 385, -87, 18, -12, 20, 44], [201, 385, -87, 18, -12, 20, 44], [18, 305.6, -170.8, 18, -12, 20, 44], [-41.9, 166.7, 107.5, 18, -12, 20, 52]],
  kabukigrin: [[-27, 1.8, -14, -26.5, 3.8, 4, 66], [-28.5, 1.8, -18, -23, 5.3, -2, 70], [12, 1.8, -40, 17, 4.8, -32, 72], [7.5, 1.6, -3, 23, 1.3, -3, 74], [-15.2, 4.6, 14.5, -29, 2.2, 15, 74]],
};
// TRIES_FILE=<json> swaps in another candidate set ({ mapId: [view, ...] })
if (process.env.TRIES_FILE) Object.assign(TRIES, JSON.parse(fs.readFileSync(process.env.TRIES_FILE, "utf8")));
const MODE = { trollface: "royale" };
const LOAD_WAIT = { grinbeach: 40000, kabukigrin: 15000, trollface: 15000 };

// Kabukigrin's clips, filmed like a vlog (user, 2026-10-26: "pretend its a
// vlog"): the camera goes from A to B (position and look-at) over `secs`,
// eased, held at phone height with a walker's bob and a hand's sway.
//   club    along the front of the stage by the DJ, the dancers facing in
//   screen  behind the two filming @SwishPng's screen, pushing in over them
const CLIPS = {
  club: { from: [-28.0, 1.6, 12.4, -18, 1.75, 16.2], to: [-27.5, 1.6, 17.4, -18, 1.75, 13.4], fov: 64, secs: 14, bob: 1, clear: 1.6, videoAt: 4 },
  screen: { from: [-21.6, 1.6, 18.0, -21.5, 3.6, 23.76], to: [-21.4, 2.0, 19.9, -21.5, 3.9, 23.76], fov: 56, secs: 12, bob: 0.35, clear: 3, keep: { z: 20.8, act: "phone" }, videoAt: 4 },
};
const CLIP_SECS = +process.env.CLIP_SECS || 0;   // (shorter, for a TRY)

const browser = await chromium.launch({ args: [`--use-angle=${process.env.ANGLE || "d3d11"}`, "--enable-unsafe-swiftshader",
  "--autoplay-policy=no-user-gesture-required", "--disable-background-timer-throttling", "--disable-renderer-backgrounding",
  // (a paused video off the page gets its decoder suspended: the club's
  // screens would freeze on one frame in the clips)
  "--disable-background-media-suspend", "--disable-features=BackgroundMediaSuspend"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.route(/supabase/, (r) => r.abort());

async function openMap(id, mode) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(`${id}: ${e.message}`));
  await page.goto(`${BASE}/troll-ops.html?tohooks=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!window.__trollOps, null, { timeout: 90000 });
  await page.evaluate(async ({ map, mode }) => {
    const T = window.__trollOps;
    if (mode === "royale") T.DROP.enabled = false;   // no sky lobby, no bus
    T.setMode(mode);
    if (T.els.noBots) T.els.noBots.checked = true;
    // a private room, never the public one
    T.els.room.value = "PV" + Math.random().toString(36).slice(2, 5).toUpperCase();
    T.els.room.dispatchEvent(new Event("input"));
    T.loadout.mapId = map;
    await T.startGame();
    if (T.isStaging()) T.endStaging();
  }, { map: id, mode });
  await page.waitForFunction(() => !!window.__trollOps.builtMap()?.map && !window.__trollOps.loadState().open, null, { timeout: 240000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, +(process.env.WAIT || LOAD_WAIT[id] || 6000)));
  // a clean picture: no gun, no hurt blur, no Royale zone wall or loot beams
  // (EXPOSURE=<n> lifts the tone mapping for a darker map)
  await page.evaluate((exposure) => {
    const T = window.__trollOps, C = T.composer;
    if (exposure) T.renderer.toneMappingExposure = exposure;
    for (const p of C.passes) {
      for (const k of ["uHitFlash", "uLowHp", "uAberration", "uSuppress"]) if (p.uniforms?.[k]) p.uniforms[k].value = 0;
      if (p.constructor.name === "ViewmodelPass") p.enabled = false;
    }
    const roy = T.royale?.();
    if (roy) {
      if (roy.visual?.group) roy.visual.group.visible = false;
      for (const m of [roy.loot?.beams, roy.loot?.rings]) if (m) m.visible = false;
      for (const it of roy.loot?.items?.values?.() || []) if (it.mesh) it.mesh.visible = false;
    }
  }, +process.env.EXPOSURE || 0);
  return page;
}

async function still(page, v, W, H) {
  return page.evaluate(async ({ v, W, H }) => {
    const T = window.__trollOps, R = T.renderer, C = T.composer, cam = T.camera;
    for (const rt of [C.renderTarget1, C.renderTarget2]) if (rt.samples !== 4) { rt.samples = 4; rt.dispose(); }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return await new Promise((done) => requestAnimationFrame(() => {
      cam.fov = v[6]; cam.aspect = W / H; cam.near = 0.1; cam.far = 2000;
      cam.position.set(v[0], v[1], v[2]);
      cam.lookAt(v[3], v[4], v[5]);
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld(true);
      T.townNpcs?.()?.update(0, cam.position);
      R.setPixelRatio(1); R.setSize(W, H, false);
      C.setPixelRatio?.(1); C.setSize(W, H);
      for (const p of C.passes) for (const k of ["uHitFlash", "uLowHp", "uAberration", "uSuppress"]) if (p.uniforms?.[k]) p.uniforms[k].value = 0;
      C.render(0.016);
      done(R.domElement.toDataURL("image/png"));
    }));
  }, { v, W, H });
}
const png = (data) => Buffer.from(data.split(",")[1], "base64");
function encodeStill(master, name) {
  for (const w of [1280, 1920]) {
    execFileSync(FFMPEG, ["-v", "error", "-y", "-i", master, "-vf", `scale=${w}:-2:flags=lanczos+accurate_rnd+full_chroma_int`,
      "-c:v", "libwebp", "-quality", "86", "-compression_level", "6", "-preset", "picture", path.join(OUT, `${name}-${w}.webp`)]);
  }
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === "shots") {
  const ids = rest.length ? rest : Object.keys(TRY ? { ...VIEWS, ...TRIES } : VIEWS);
  for (const id of ids) {
    const page = await openMap(id, process.env.MODE || MODE[id] || "tdm");
    const list = TRY ? [...(VIEWS[id] || []), ...(TRIES[id] || [])] : VIEWS[id] || [];
    for (const [i, v] of list.entries()) {
      if (TRY) {
        fs.writeFileSync(path.join(TRYDIR, `${id}-${i}.png`), png(await still(page, v, 960, 540)));
        console.log(`${id}-${i}: ${v.join(",")}`);
        continue;
      }
      const master = path.join(MASTER, `${id}-${i + 1}.png`);
      // a lost GPU context draws an empty frame (a PNG of a few KB): try
      // again, and stop rather than encode a black still
      let shot = png(await still(page, v, 2560, 1440));
      for (let k = 0; shot.length < 200e3 && k < 3; k++) {
        console.log(`${id}-${i + 1}: empty frame, again`);
        await new Promise((r) => setTimeout(r, 3000));
        shot = png(await still(page, v, 2560, 1440));
      }
      if (shot.length < 200e3) throw new Error(`${id}-${i + 1}: still empty`);
      fs.writeFileSync(master, shot);
      encodeStill(master, `${id}-${i + 1}`);
      console.log(`${id}-${i + 1}: master + 2 webp`);
    }
    await page.close();
  }
} else if (cmd === "clip") {
  const name = rest[0] || "club", CLIP = CLIPS[name];
  if (!CLIP) throw new Error(`no clip "${name}": ${Object.keys(CLIPS).join(", ")}`);
  const secs = CLIP_SECS || CLIP.secs;
  // drawn at twice the size (SS) and scaled down at the encode: a fine
  // pattern far off (the club's slatted pink wall) shimmers frame to frame
  // at 1:1
  const SS = +process.env.SS || 2;
  const W = (TRY ? 1280 : 1920) * SS, H = (TRY ? 720 : 1080) * SS, FPS = 30, N = Math.round(secs * FPS);
  const dir = path.join(TRY ? TRYDIR : MASTER, `${name}-frames`);
  // ENCODE_ONLY=1 re-encodes the frames already in .claude/reel-hq
  if (!process.env.ENCODE_ONLY) {
  const page = await openMap("kabukigrin", "social");
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  // The camera is put on the glide inside the game's own render (after its
  // update, so the player's view never shows), the crowd is shown by room
  // from there, and the frame is read back in the same call. The screens'
  // videos (video-wall.js draws them onto canvases) are caught at that draw,
  // held, and seeked to each frame's time below.
  await page.evaluate(({ clip, secs, W, H }) => {
    const T = window.__trollOps, R = T.renderer, C = T.composer, cam = T.camera;
    for (const rt of [C.renderTarget1, C.renderTarget2]) if (rt.samples !== 4) { rt.samples = 4; rt.dispose(); }
    const sz = () => { R.setPixelRatio(1); R.setSize(W, H, false); C.setPixelRatio?.(1); C.setSize(W, H); };
    sz();
    const reel = window.__reel = { k: 0, want: false, shot: null, vids: new Set(), realTimeout: setTimeout.bind(window), realClear: clearTimeout.bind(window) };   // (the timers from before the clock is faked)
    const di = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (src, ...a) {
      if (src instanceof HTMLVideoElement && !reel.vids.has(src)) {
        reel.vids.add(src); src.__t0 = clip.videoAt ?? src.currentTime; src.pause();
        // on the page (a corner pixel), so Chrome keeps decoding it
        src.style.cssText = "position:fixed;left:0;top:0;width:2px;height:2px;opacity:.01;pointer-events:none;z-index:-1";
        document.body.appendChild(src);
      }
      return di.call(this, src, ...a);
    };
    HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
    // (the stepped clock can hand the 3D sound a non-finite time; the clip is
    // silent anyway)
    const sv = AudioParam.prototype.setValueAtTime;
    AudioParam.prototype.setValueAtTime = function (v, t) { return Number.isFinite(v) && Number.isFinite(t) ? sv.call(this, v, t) : this; };
    const ease = (k) => k * k * (3 - 2 * k);
    const render = C.render.bind(C);
    // the hand: a step's bob (two a second), a slow sway and drift of the
    // aim, a little roll; sums of sines, so it never quite repeats
    const sway = (t) => {
      const S = (a, f, ph = 0) => a * Math.sin(t * f * Math.PI * 2 + ph);
      return {
        x: S(0.018, 0.37) + S(0.008, 1.1, 2), y: clip.bob * 0.022 * Math.abs(Math.sin(t * Math.PI * 1.9)) + S(0.006, 0.6, 1),
        ax: S(0.07, 0.21, 1) + S(0.025, 0.83), ay: S(0.045, 0.29, 3) + S(0.015, 1.3), roll: S(0.012, 0.17) + S(0.005, 0.9, 2),
      };
    };
    C.render = (dt) => {
      const k = ease(reel.k), h = sway(reel.k * secs);
      const p = clip.from.map((a, i) => a + (clip.to[i] - a) * k);
      if (R.domElement.width !== W) sz();
      cam.fov = clip.fov; cam.aspect = W / H; cam.near = 0.1; cam.far = 2000;
      cam.position.set(p[0] + h.x, p[1] + h.y, p[2]);
      cam.lookAt(p[3] + h.ax, p[4] + h.ay, p[5]);
      cam.rotateZ(h.roll);
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld(true);
      T.townNpcs?.()?.update(0, cam.position);
      // no name tags in a vlog, and nobody right in the lens (a passer-by's head
      // filling the frame)
      for (const n of T.townNpcs?.()?.list || []) {
        if (n.tag) n.tag.visible = false;
        const kept = clip.keep && Math.abs(n.z - clip.keep.z) < 0.3 && n.c.act === clip.keep.act;   // (the two filming the screen)
        if (!kept && Math.hypot(n.x - cam.position.x, n.z - cam.position.z) < clip.clear) n.rig.root.visible = false;
      }
      for (const ps of C.passes) for (const key of ["uHitFlash", "uLowHp", "uAberration", "uSuppress"]) if (ps.uniforms?.[key]) ps.uniforms[key].value = 0;
      const out = render(dt);
      if (reel.want) { reel.want = false; reel.shot = R.domElement.toDataURL("image/jpeg", 0.95); }
      return out;
    };
  }, { clip: CLIP, secs, W, H });
  // Time is stepped, not run: Playwright's clock moves the page one frame at
  // a time (the crowd, the lights, the lasers), so the clip is smooth at 30
  // fps whatever the GPU manages in real time.
  await page.clock.install();
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 2000);
  // run the club until the screens' videos are caught, loaded and drawn (the
  // clip never opens on a black screen), a minute of real time at most
  for (let i = 0, ok = 0; ok < 30 && i < 1800; i++) {
    await page.clock.runFor(1000 / FPS);
    await new Promise((r) => setTimeout(r, 30));
    const ready = await page.evaluate(() => { const v = [...window.__reel.vids]; return v.length > 0 && v.every((x) => x.readyState >= 2); });
    ok = ready ? ok + 1 : 0;
  }
  let wrote = 0;
  for (let i = 0; i < N; i++) {
    await page.evaluate(async ({ k, t }) => {
      const reel = window.__reel;
      reel.k = k;
      reel.want = true;
      await Promise.all([...reel.vids].map((v) => {
        const to = (v.__t0 + t) % (v.duration || 1e9);
        if (Math.abs(v.currentTime - to) < 1e-3) return null;
        // seeked, then the frame there decoded and presented (or 1 s, real time)
        return new Promise((r) => {
          const done = () => { reel.realClear(t1); r(); };
          const t1 = reel.realTimeout(done, 1000);   // (the page clock is paused: a real timer)
          v.addEventListener("seeked", () => (v.requestVideoFrameCallback ? v.requestVideoFrameCallback(done) : done()), { once: true });
          v.currentTime = to;
        });
      }));
    }, { k: i / (N - 1), t: i / FPS });
    await page.clock.runFor(1000 / FPS);
    const shot = await page.evaluate(() => { const s = window.__reel.shot; window.__reel.shot = null; return s; });
    if (!shot) { console.log(`frame ${i}: no render`); continue; }
    fs.writeFileSync(path.join(dir, `${String(wrote++).padStart(5, "0")}.jpg`), png(shot));
  }
  const vids = await page.evaluate(() => window.__reel.vids.size);
  console.log(`${name}: ${wrote}/${N} frames, ${vids} screen videos stepped, in ${dir}`);
  }
  // from the second frame: the screens' first seek presents a frame late, so
  // the first one has them black (a flash each time the clip starts)
  const seq = ["-framerate", String(FPS), "-start_number", "1", "-i", path.join(dir, "%05d.jpg")];
  if (TRY) {
    execFileSync(FFMPEG, ["-v", "error", "-y", ...seq, "-c:v", "libx264", "-crf", "20", "-pix_fmt", "yuv420p", path.join(TRYDIR, `kabukigrin-${name}.mp4`)]);
  } else {
    for (const w of [1280, 1920]) {
      // limited (TV) range: the canvas JPEGs are full range, and a full-range
      // VP9 fails Chrome's hardware decoder on Windows (MEDIA_ERR_DECODE)
      const vf = `scale=${w}:-2:flags=lanczos:out_range=tv`;
      // capped: a backdrop behind glass panels, not a master (the lasers and
      // the money rain would take every bit they're given)
      const kb = w > 1280 ? 2400 : 1400;
      execFileSync(FFMPEG, ["-v", "error", "-y", ...seq, "-vf", vf, "-an", "-c:v", "libvpx-vp9", "-b:v", `${kb}k`, "-maxrate", `${kb * 1.3}k`, "-bufsize", `${kb * 2}k`,
        "-pix_fmt", "yuv420p", "-color_range", "tv", "-row-mt", "1", "-deadline", "good", "-cpu-used", "2", path.join(OUT, `kabukigrin-${name}-${w}.webm`)]);
      execFileSync(FFMPEG, ["-v", "error", "-y", ...seq, "-vf", vf, "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-maxrate", `${kb * 1.4}k`, "-bufsize", `${kb * 2}k`,
        "-pix_fmt", "yuv420p", "-color_range", "tv", "-movflags", "+faststart", path.join(OUT, `kabukigrin-${name}-${w}.mp4`)]);
      console.log(`${name} ${w}: webm + mp4`);
    }
  }
} else {
  console.log("usage: troll-ops-lobby-reel.mjs shots [mapId ...] | clip club|screen");
}
await browser.close();
server.close();
