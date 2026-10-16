// Troll Forces — load maps while you sit in the main menu, so joining a
// match doesn't hitch.
//
// What made a join lag: the map's models and textures were fetched as the
// match began, every texture was uploaded to the GPU on the first frame it
// was seen, and every new material compiled its shader on first draw. The
// lobby already builds the selected map as its backdrop, but under the BO2
// menu nothing is drawn (game.js skips composer.render while
// body.to-bo2-cover is set), so none of that work happened until you spawned.
//
// Preloading a map here:
//   1. builds it into a throwaway root (its own colliders and bounds, so the
//      live arena is untouched) — this starts every model/texture download;
//   2. waits until three's loading manager has nothing left in flight;
//   3. parks the root far below the arena, uploads its textures and compiles
//      its shaders with compileAsync, then takes it out of the scene again.
// The finished build is kept (a small LRU), and game.js's loadMap adopts it
// instead of building the map a second time — so a preloaded map is one
// swap of colliders, not a rebuild.
//
// Shaders stay compiled because the throwaway's materials are never
// disposed: three only frees a program when the last material using it is
// disposed.

import * as THREE from "three";

const KEEP_BUILT = 3;          // finished builds held for loadMap to adopt
const SETTLE_MS = 350;         // the loading manager must stay idle this long
const MAX_WAIT_MS = 45000;     // give up waiting on a download that never ends
const PARK_Y = -600;           // out of every camera's sight

/* Count what three's loaders have in flight. Every GLTFLoader and
   TextureLoader in the game uses the default manager. */
const mgr = THREE.DefaultLoadingManager;
const net = { pending: 0, started: 0, finished: 0 };
// When each map's preload ran, so manifest() can sort the page's resource
// timing entries by map ("lobby" = anything outside a window). Resource
// timing, not the loading manager, because some files (music, zombie rigs)
// are fetched without it.
const windows = [];
// The default buffer (250 entries) fills before the menu has finished.
performance.setResourceTimingBufferSize?.(3000);
{
  const start = mgr.itemStart.bind(mgr), end = mgr.itemEnd.bind(mgr);
  mgr.itemStart = (url) => { net.pending++; net.started++; start(url); };
  mgr.itemEnd = (url) => { net.pending = Math.max(0, net.pending - 1); net.finished++; end(url); };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const frame = () => new Promise((r) => (document.hidden ? setTimeout(r, 16) : requestAnimationFrame(() => r())));

/* `getLive()` returns `{ id, root }` of the map currently in the scene. */
export function createMapPreloader({ renderer, scene, camera, buildMap, maps, ids, getLive, canRun = () => true, compileScene }) {
  // game.js passes compileScene so the compile matches how the world is
  // really drawn (into the composer's buffer, not straight to the screen).
  const compile = compileScene || (() => (renderer.compileAsync ? renderer.compileAsync(scene, camera) : renderer.compile(scene, camera)));
  const state = new Map();       // id -> { state, progress, error }
  const built = new Map();       // id -> { built, colliders, arena }, insertion order = LRU
  const listeners = new Set();
  let queue = Promise.resolve();
  let current = null;            // id being preloaded right now
  let busy = 0;

  for (const id of ids) state.set(id, { state: "idle", progress: 0 });

  const emit = () => { for (const fn of listeners) { try { fn(); } catch (e) { console.warn("[preload]", e); } } };
  const set = (id, patch) => { state.set(id, { ...(state.get(id) || {}), ...patch }); emit(); };

  /* Wait until nothing has been downloading for SETTLE_MS, reporting
     progress as finished / started since `base`. */
  async function settle(id, base) {
    const t0 = performance.now();
    let idleSince = 0;
    for (;;) {
      const started = net.started - base.started, finished = net.finished - base.finished;
      const p = started > 0 ? finished / started : 1;
      set(id, { progress: 0.05 + 0.75 * Math.min(1, p) });
      if (net.pending === 0) {
        if (!idleSince) idleSince = performance.now();
        if (performance.now() - idleSince >= SETTLE_MS) return;
      } else idleSince = 0;
      if (performance.now() - t0 > MAX_WAIT_MS) return;
      await sleep(120);
    }
  }

  /* Push every texture of `root` to the GPU, a few per frame so the menu
     stays smooth. */
  async function uploadTextures(root) {
    const seen = new Set();
    root.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of [].concat(o.material)) {
        if (!m) continue;
        for (const k of ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap", "alphaMap", "lightMap", "bumpMap"]) {
          const t = m[k];
          if (t && t.isTexture && t.image) seen.add(t);
        }
      }
    });
    let n = 0;
    for (const t of seen) {
      try { renderer.initTexture(t); } catch (e) { /* not decoded yet: it uploads on first draw instead */ }
      if (++n % 6 === 0) await frame();
    }
  }

  /* The map already in the scene (the lobby backdrop) is warmed where it
     stands rather than built a second time. */
  async function warmLive(id, root) {
    const base = { started: net.started, finished: net.finished };
    await settle(id, base);
    set(id, { state: "compiling", progress: 0.82 });
    await uploadTextures(root);
    set(id, { progress: 0.9 });
    await compile();
    set(id, { state: "ready", progress: 1 });
  }

  async function run(id) {
    if (!maps[id]) return;
    const live = getLive?.();
    const isLive = live && live.id === id && live.root?.parent === scene;
    if (state.get(id)?.state === "ready" && (built.has(id) || isLive)) return;
    current = id;
    const win = { map: id, t0: performance.now(), t1: Infinity };
    windows.push(win);
    busy++;
    set(id, { state: "loading", progress: 0.02, error: null });
    await frame();
    try {
      if (isLive) { await warmLive(id, live.root); return; }
      // Building a map that is not on screen waits for the menu.
      while (!canRun()) await sleep(500);
      const base = { started: net.started, finished: net.finished };
      const colliders = [];
      const arena = {};
      const b = buildMap(id, { colliders, arena });
      await settle(id, base);

      set(id, { state: "compiling", progress: 0.82 });
      b.root.position.y += PARK_Y;
      scene.add(b.root);
      try {
        await uploadTextures(b.root);
        set(id, { progress: 0.9 });
        await compile();
      } finally {
        scene.remove(b.root);
        b.root.position.y -= PARK_Y;
      }

      built.delete(id);
      built.set(id, { built: b, colliders, arena });
      while (built.size > KEEP_BUILT) {
        const [oldId, old] = built.entries().next().value;
        built.delete(oldId);
        dropBuild(old.built);   // its downloads and shaders stay warm
      }
      set(id, { state: "ready", progress: 1 });
    } catch (e) {
      console.warn("[preload]", id, e);
      set(id, { state: "error", progress: 0, error: String(e?.message || e) });
    } finally {
      busy--;
      win.t1 = performance.now();
      current = null;
      emit();
    }
  }

  /* Free a kept build's own geometry. Materials stay alive on purpose (their
     shaders stay compiled), and model geometry is shared with the loader's
     cache, so only the procedural pieces are freed. */
  function dropBuild(b) {
    b.root.traverse((o) => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); });
  }

  const api = {
    /* Queue a map; resolves when it is ready. Re-queuing a ready map is free. */
    preload(id) {
      queue = queue.then(() => run(id));
      return queue;
    },
    preloadAll(order = ids) {
      for (const id of order) api.preload(id);
      return queue;
    },
    /* For loadMap: the finished build of `id`, removed from the cache (the
       match owns it now). null when there isn't one. The map still reads as
       ready: its files and shaders are warm, so a rebuild is quick. */
    take(id) {
      const b = built.get(id);
      if (!b) return null;
      built.delete(id);
      return b;
    },
    /* The files three has loaded so far, site-relative, grouped by map —
       run after every map is ready to regenerate
       assets/games/troll-ops/prefetch-manifest.json (localhost:
       `copy(JSON.stringify(__trollPreload.manifest(), null, 1))`). Files
       that 404'd (the optional -bake.jpg lightmaps) are left out. */
    manifest() {
      const out = { lobby: [] };
      const done = new Set();
      for (const e of performance.getEntriesByType("resource")) {
        const abs = new URL(e.name);
        // Same-site files only, and not the code: the home crawls that live
        // so its ?v= tags are never stale.
        if (abs.origin !== location.origin || done.has(abs.href)) continue;
        if (/\.(m?js|css|html|json)$/.test(abs.pathname) || /-bake\.jpg$/.test(abs.pathname)) continue;
        if (e.responseStatus >= 400) continue;
        done.add(abs.href);
        const w = windows.find((x) => e.startTime >= x.t0 && e.startTime <= x.t1);
        (out[w ? w.map : "lobby"] ||= []).push(abs.pathname.replace(/^\//, "") + abs.search);
      }
      return out;
    },
    /* loadMap built `id` itself (nothing preloaded): it's in the scene now. */
    noteLive(id) { if (state.get(id)?.state === "idle") api.preload(id); },
    status(id) { return state.get(id) || { state: "idle", progress: 0 }; },
    get current() { return current; },
    get busy() { return busy > 0; },
    readyCount() { let n = 0; for (const s of state.values()) if (s.state === "ready") n++; return n; },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    ids,
    names: Object.fromEntries(ids.map((id) => [id, maps[id]?.name || id])),
  };
  return api;
}
