/* The menu's backdrop: the troll world map (trollrunner.net/maps) as a huge
   molten planet, backlit by a sun, with an asteroid field drifting past.
   A Black Ops 2 Zombies menu, troll edition. Placeholder art until real art
   lands; everything here is code, no images. Shared: the trollrunner.net
   home menu and the Troll Forces menu both mount it.

   Same engine as maps.html (MapLibre GL, pinned to v5: v6 ships its tile
   worker as a chunk a static site can't resolve and the globe goes black
   with no error). Unlike maps.html it pulls NO tiles: the style is built
   here from assets/geo/countries.json, so the only network is MapLibre
   itself (lazy, from jsDelivr) and the troll pins (Supabase, already in the
   page's CSP; it needs worker-src blob: for MapLibre's worker). Coastlines
   and borders are the molten cracks; every troll who pinned their city is
   a hot spot.

   mountMenuBackdrop(host) -> { pause, resume, destroy, map }. Nothing loads
   until it is called, so the game's first paint never waits on it. pause()
   stops both render loops (call it when a match starts); with no WebGL the
   sun and asteroids still draw and the planet is a CSS stand-in. */

const MAPLIBRE = "https://cdn.jsdelivr.net/npm/maplibre-gl@5.24.0/dist/maplibre-gl.js";
const COUNTRIES = new URL("../geo/countries.json", import.meta.url).href;

// Degrees of longitude per second: one turn in about six minutes.
const SPIN = 1.0;
// The planet: centre as a fraction of the host, radius as a fraction of its
// height (of its width on tall phones). It sits left, half off screen,
// under the menu, like the BO2 Zombies planet; the sun burns on its right.
const PLANET = { x: 0.2, y: 0.6, r: 0.64, rw: 0.8 };
const TILT_LAT = 22;

const CSS = `
.tr-space{position:absolute;inset:0;overflow:hidden;background:#030101;pointer-events:none;contain:strict}
.tr-space-sky{position:absolute;inset:0;background:
  radial-gradient(ellipse 55% 7% at var(--sun-x) var(--sun-y),rgba(255,226,160,.85) 0,rgba(255,150,50,.4) 30%,rgba(255,110,30,0) 100%),
  radial-gradient(ellipse 80% 22% at calc(var(--sun-x) + 18%) var(--sun-y),rgba(200,90,20,.28) 0,rgba(120,40,10,0) 100%),
  radial-gradient(circle at var(--sun-x) var(--sun-y),#fffbe8 0,#ffe09a 2.2%,rgba(255,170,70,.8) 5%,rgba(230,90,25,.32) 14%,rgba(120,30,8,.12) 32%,rgba(0,0,0,0) 58%),
  radial-gradient(ellipse 120% 80% at 70% 110%,#1d0904 0,#070201 55%,#020000 100%)}
.tr-space-rays{position:absolute;left:var(--sun-x);top:var(--sun-y);width:260vmax;height:260vmax;margin:-130vmax 0 0 -130vmax;
  background:repeating-conic-gradient(from 0deg,rgba(255,190,110,.10) 0deg 2.2deg,rgba(255,190,110,0) 2.2deg 9deg);
  -webkit-mask:radial-gradient(circle,#000 0,rgba(0,0,0,.55) 8%,rgba(0,0,0,0) 34%);mask:radial-gradient(circle,#000 0,rgba(0,0,0,.55) 8%,rgba(0,0,0,0) 34%);
  animation:tr-space-spin 240s linear infinite}
@keyframes tr-space-spin{to{transform:rotate(360deg)}}
.tr-space-planet,.tr-space-limb,.tr-space-shade,.tr-space-standin{position:absolute;left:calc(var(--px) - var(--pr));top:calc(var(--py) - var(--pr));width:calc(var(--pr) * 2);height:calc(var(--pr) * 2);border-radius:50%}
.tr-space-standin{background:radial-gradient(circle at 34% 30%,#3a1e10 0,#1a0b05 45%,#070201 75%)}
.tr-space-planet{border-radius:0;opacity:0;transition:opacity 1.6s ease;left:calc(var(--px) - var(--pr) * 1.3);top:calc(var(--py) - var(--pr) * 1.3);width:calc(var(--pr) * 2.6);height:calc(var(--pr) * 2.6)}
.tr-space-planet.is-ready{opacity:1}
.tr-space-planet .maplibregl-canvas{outline:none}
.tr-space-planet.is-ready + .tr-space-standin{opacity:0;transition:opacity 1.6s ease}
/* The face toward us is in shadow (the sun is behind the planet), the limb
   facing the sun burns. */
.tr-space-shade{background:radial-gradient(circle at var(--shade-x) var(--shade-y),rgba(0,0,0,0) 0,rgba(0,0,0,0) 52%,rgba(3,1,0,.55) 78%,rgba(3,1,0,.82) 100%)}
.tr-space-limb{box-shadow:
  inset var(--limb-dx) var(--limb-dy) calc(var(--pr) * .05) calc(var(--pr) * -.01) rgba(255,214,140,.95),
  inset calc(var(--limb-dx) * 2.4) calc(var(--limb-dy) * 2.4) calc(var(--pr) * .16) rgba(255,110,30,.55),
  calc(var(--limb-dx) * -.6) calc(var(--limb-dy) * -.6) calc(var(--pr) * .12) calc(var(--pr) * .01) rgba(255,120,40,.35)}
.tr-space-rocks{position:absolute;inset:0;width:100%;height:100%}
.tr-space-vignette{position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,.5) 0,rgba(0,0,0,.25) 26%,rgba(0,0,0,0) 42%),radial-gradient(ellipse at 50% 50%,rgba(0,0,0,0) 55%,rgba(0,0,0,.6) 100%)}
/* Map mode: the planet becomes the interactive troll map. */
.tr-space.is-map{pointer-events:none}
.tr-space.is-map .tr-space-planet{left:0;top:0;width:100%;height:100%;pointer-events:auto}
.tr-space.is-map .tr-space-planet canvas{touch-action:none;cursor:grab}
.tr-space.is-map .tr-space-planet canvas:active{cursor:grabbing}
.tr-space.is-map .tr-space-planet.is-pin canvas{cursor:pointer}
.tr-space.is-map .tr-space-planet.is-picking canvas{cursor:crosshair}
.tr-space-limb,.tr-space-shade,.tr-space-rocks,.tr-space-vignette{transition:opacity .5s ease}
.tr-space.is-map .tr-space-limb,.tr-space.is-map .tr-space-shade,.tr-space.is-map .tr-space-standin{opacity:0}
.tr-space.is-map .tr-space-rocks{opacity:.35}
.tr-space.is-map .tr-space-vignette{opacity:.6}
.tr-space.is-swap .tr-space-planet{transition:none}
@media (prefers-reduced-motion: reduce){.tr-space-rays{animation:none}}
`;

let libPromise = null;
function loadLib() {
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  if (!libPromise) {
    libPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = MAPLIBRE;
      s.async = true;
      s.onload = () => (window.maplibregl ? resolve(window.maplibregl) : reject(new Error("maplibre missing")));
      s.onerror = () => { libPromise = null; reject(new Error("maplibre failed to load")); };
      document.head.appendChild(s);
    });
  }
  return libPromise;
}

function webglOk() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
}

// Same view and columns as maps.html (troll-map.js listPins). RLS keeps
// hidden pins out; coordinates are already rounded to ~1 km server-side.
async function loadPins() {
  const A = window.TrollrunnerAccounts;
  const sb = A && A.getClient && A.getClient();
  if (!sb) return [];
  try {
    const { data, error } = await sb.from("troll_locations_view")
      .select("user_id, lat, lng, label, country, username, avatar_url, level")
      .order("updated_at", { ascending: false }).limit(5000);
    if (error) return [];
    return (data || []).filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng)).map((r) => ({
      userId: r.user_id, lat: r.lat, lng: r.lng, label: r.label || "", country: r.country || "",
      username: r.username || "troll", avatarUrl: r.avatar_url || "", level: r.level || 1,
    }));
  } catch { return []; }
}

const pinsGeo = (pins) => ({
  type: "FeatureCollection",
  features: pins.map((p, i) => ({ type: "Feature", properties: { i }, geometry: { type: "Point", coordinates: [p.lng, p.lat] } })),
});
const MAP_HANDLERS = ["dragPan", "scrollZoom", "touchZoomRotate", "doubleClickZoom", "keyboard"];

// Seeded so the crust and the rocks are the same every visit.
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// A tileable cooled-lava crust for the land: dark plates with hot seams.
function crustImage(size = 256) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  g.fillStyle = "#1e110a";
  g.fillRect(0, 0, size, size);
  const r = rng(7);
  const wrap = (fn) => { for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) fn(dx, dy); };
  for (let i = 0; i < 70; i++) {
    const x = r() * size, y = r() * size, rad = 6 + r() * 26, l = 9 + r() * 5;
    wrap((dx, dy) => {
      g.fillStyle = `hsl(${18 + r() * 8}, 45%, ${l}%)`;
      g.beginPath(); g.arc(x + dx, y + dy, rad, 0, Math.PI * 2); g.fill();
    });
  }
  g.lineCap = "round";
  for (let i = 0; i < 26; i++) {
    let x = r() * size, y = r() * size, a = r() * Math.PI * 2;
    const pts = [[x, y]];
    for (let k = 0; k < 6; k++) { a += (r() - 0.5) * 1.4; x += Math.cos(a) * 10; y += Math.sin(a) * 10; pts.push([x, y]); }
    const hot = r() < 0.35;
    wrap((dx, dy) => {
      g.strokeStyle = hot ? "rgba(255,120,30,.55)" : "rgba(255,90,20,.22)";
      g.lineWidth = hot ? 1.6 : 1;
      g.beginPath(); pts.forEach(([px, py], j) => (j ? g.lineTo(px + dx, py + dy) : g.moveTo(px + dx, py + dy))); g.stroke();
    });
  }
  return g.getImageData(0, 0, size, size);
}

function style() {
  return {
    version: 8,
    sources: {
      countries: { type: "geojson", data: COUNTRIES },
      pins: { type: "geojson", data: pinsGeo([]) },
      draft: { type: "geojson", data: pinsGeo([]) },
    },
    layers: [
      // The sea is near-black rock; land is crust, and the continents read
      // mostly by their glowing edges.
      { id: "sea", type: "background", paint: { "background-color": "#080302" } },
      { id: "land", type: "fill", source: "countries", paint: { "fill-color": "#2a170d" } },
      { id: "crack-glow", type: "line", source: "countries",
        paint: { "line-color": "#ff4a0c", "line-width": 7, "line-blur": 6, "line-opacity": 0.6 } },
      { id: "crack-hot", type: "line", source: "countries",
        paint: { "line-color": "#ff8a24", "line-width": 2.2, "line-blur": 1 } },
      { id: "crack", type: "line", source: "countries",
        paint: { "line-color": "#ffe0a0", "line-width": 0.7 } },
      // Each troll is a hot spot: a wide glow and a white-hot core.
      { id: "pin-glow", type: "circle", source: "pins",
        paint: { "circle-color": "#ff9a3a", "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 16, 5, 34], "circle-blur": 0.8, "circle-opacity": 0.95 } },
      { id: "pin", type: "circle", source: "pins",
        paint: { "circle-color": "#fff6d8", "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 4, 5, 7],
          "circle-stroke-color": "#ffcf70", "circle-stroke-width": 1 } },
      // The spot being picked for your own pin: a white ring, so it reads
      // apart from the trolls already there.
      { id: "draft-glow", type: "circle", source: "draft",
        paint: { "circle-color": "#ffffff", "circle-radius": 26, "circle-blur": 1, "circle-opacity": 0.55 } },
      { id: "draft", type: "circle", source: "draft",
        paint: { "circle-color": "#ff4a0c", "circle-radius": 7, "circle-stroke-color": "#ffffff", "circle-stroke-width": 3 } },
    ],
  };
}

// Asteroids: a belt of lumpy rocks streaming away from the sun, lit from
// its side. Each rock keeps an offset from the belt's centre line (dy); the
// belt fans out the farther it gets from the sun.
function makeRocks(seed = 11) {
  const r = rng(seed);
  const rocks = [];
  for (let i = 0; i < 170; i++) {
    const depth = r() ** 1.6;                // most rocks far and small
    const n = 7 + Math.floor(r() * 5);
    const shape = [];
    for (let k = 0; k < n; k++) shape.push(0.7 + r() * 0.45);
    rocks.push({
      x: r(), dy: (r() + r() + r() - 1.5) * 0.42, depth,
      size: 1 + depth ** 3 * 22 + r() * 1.6,
      shape, rot: r() * 6.28, spin: (r() - 0.5) * 0.25,
      vx: 0.003 + depth * 0.01,
    });
  }
  return rocks.sort((a, b) => a.depth - b.depth);
}
// The belt runs from just left of the sun to off the right edge.
const beltX = (sun, x) => sun.x + 0.03 + x * (1.12 - sun.x);
const beltY = (sun, k, bx) => sun.y + k.dy * (0.16 + Math.abs(bx - sun.x) * 0.5);

function drawRocks(ctx, w, h, rocks, sun, dpr) {
  ctx.clearRect(0, 0, w, h);
  for (const k of rocks) {
    const bx = beltX(sun, k.x);
    const x = bx * w, y = beltY(sun, k, bx) * h, s = k.size * dpr;
    const lx = sun.x * w - x, ly = sun.y * h - y, ll = Math.hypot(lx, ly) || 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(k.rot);
    ctx.beginPath();
    k.shape.forEach((m, i) => {
      const a = (i / k.shape.length) * Math.PI * 2;
      const px = Math.cos(a) * s * m, py = Math.sin(a) * s * m * 0.8;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    });
    ctx.closePath();
    ctx.rotate(-k.rot);
    const ux = (lx / ll) * s * 0.6, uy = (ly / ll) * s * 0.6;
    const g = ctx.createRadialGradient(ux, uy, s * 0.1, 0, 0, s * 1.15);
    const fade = 0.35 + k.depth * 0.65;
    g.addColorStop(0, `rgba(${Math.round(120 * fade)},${Math.round(58 * fade)},${Math.round(24 * fade)},1)`);
    g.addColorStop(0.45, `rgba(${Math.round(26 * fade)},${Math.round(12 * fade)},${Math.round(7 * fade)},1)`);
    g.addColorStop(1, "rgba(6,2,1,1)");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
  }
}

export function mountMenuBackdrop(host) {
  if (!document.getElementById("tr-space-css")) {
    const st = document.createElement("style");
    st.id = "tr-space-css";
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  const root = document.createElement("div");
  root.className = "tr-space";
  root.setAttribute("aria-hidden", "true");
  root.innerHTML = `<div class="tr-space-sky"></div><div class="tr-space-rays"></div>
    <canvas class="tr-space-rocks" data-layer="far"></canvas>
    <div class="tr-space-planet"></div><div class="tr-space-standin"></div>
    <div class="tr-space-shade"></div><div class="tr-space-limb"></div>
    <canvas class="tr-space-rocks" data-layer="near"></canvas>
    <div class="tr-space-vignette"></div>`;
  host.prepend(root);

  const planetEl = root.querySelector(".tr-space-planet");
  const [farCv, nearCv] = root.querySelectorAll(".tr-space-rocks");
  const rocks = makeRocks();
  const far = rocks.filter((k) => k.depth < 0.62), near = rocks.filter((k) => k.depth >= 0.62);

  let map = null, raf = 0, last = 0, paused = false, dead = false;
  let geom = null;
  let pins = [];
  let mapMode = null;      // { onPin, inset } while the planet is the live map
  let busy = false;        // a mode change is easing
  let picker = null;       // fn({ lat, lng }, point) taking every tap in map mode
  let draft = null;        // { lat, lng } of the spot being picked

  // Lay out the planet and the sun from the host's size.
  function layout() {
    const w = root.clientWidth || 1, h = root.clientHeight || 1;
    // Phones (portrait): the planet up top-left, the menu sits under it.
    const tall = w < h * 0.9;
    const pr = tall ? w * PLANET.rw : h * PLANET.r;
    const px = tall ? w * 0.12 : w * PLANET.x, py = tall ? pr * 0.95 : h * PLANET.y;
    // Sun just behind the planet's upper-right limb.
    const sx = px + pr * 0.8, sy = py - pr * 0.64;
    const ang = Math.atan2(sy - py, sx - px);
    const s = root.style;
    s.setProperty("--px", `${px}px`); s.setProperty("--py", `${py}px`); s.setProperty("--pr", `${pr}px`);
    s.setProperty("--sun-x", `${sx}px`); s.setProperty("--sun-y", `${sy}px`);
    s.setProperty("--limb-dx", `${-Math.cos(ang) * pr * 0.035}px`); s.setProperty("--limb-dy", `${-Math.sin(ang) * pr * 0.035}px`);
    s.setProperty("--shade-x", `${50 + Math.cos(ang) * 30}%`); s.setProperty("--shade-y", `${50 + Math.sin(ang) * 30}%`);
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    for (const cv of [farCv, nearCv]) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    // Rocks scale with the screen, so a phone isn't all boulder.
    geom = { w, h, pr, px, py, sun: { x: sx / w, y: sy / h }, dpr, rockScale: dpr * Math.min(1, Math.min(w, h) / 900) };
    if (map) { map.resize(); if (!mapMode && !busy) fitZoom(); }
  }
  // Zoom so MapLibre's globe radius on screen matches --pr. Its perspective
  // camera makes the formula only approximate, so measure: walk north from
  // the view centre along the meridian; the screen distance peaks at the
  // visible limb.
  const pointNorth = (c, a) => {
    const lat = c.lat + a;
    return lat > 90 ? [c.lng + 180, 180 - lat] : [c.lng, lat];
  };
  function limbRadius() {
    const c = map.getCenter(), mid = map.project(c);
    let best = 0;
    for (let a = 40; a <= 100; a += 0.5) {
      const p = map.project(pointNorth(c, a));
      best = Math.max(best, Math.hypot(mid.x - p.x, mid.y - p.y));
    }
    return best;
  }
  function fitZoom() {
    if (!map || !geom) return;
    const lat = map.getCenter().lat * Math.PI / 180;
    map.setZoom(Math.log2((geom.pr * 2 * Math.PI) / (512 * Math.cos(lat))));
    for (let i = 0; i < 4; i++) {
      const r = limbRadius();
      if (!(r > 1) || Math.abs(r - geom.pr) < 0.5) break;
      map.setZoom(map.getZoom() + Math.log2(geom.pr / r));
    }
  }

  function frame(t) {
    raf = 0;
    if (paused || dead) return;
    const dt = last && !still ? Math.min(0.1, (t - last) / 1000) : 0;
    last = t;
    if (map && !mapMode && !busy) {
      const c = map.getCenter();
      map.setCenter([((c.lng + SPIN * dt + 540) % 360) - 180, c.lat]);
    }
    for (const k of rocks) {
      k.x += k.vx * dt; k.rot += k.spin * dt;
      if (k.x > 1) k.x -= 1;
    }
    const { sun, rockScale } = geom;
    drawRocks(farCv.getContext("2d"), farCv.width, farCv.height, far, sun, rockScale);
    drawRocks(nearCv.getContext("2d"), nearCv.width, nearCv.height, near, sun, rockScale);
    // Reduced motion: draw once (and again on resize), never animate.
    if (!still) raf = requestAnimationFrame(frame);
  }
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const run = () => { if (!raf && !paused && !dead) { last = 0; raf = requestAnimationFrame(frame); } };

  layout();
  const ro = new ResizeObserver(() => { layout(); run(); });
  ro.observe(root);
  run();

  // One retry: a flaky CDN fetch shouldn't leave the stand-in planet up.
  const loadLibRetry = () => loadLib().catch(() => new Promise((res) => setTimeout(res, 3000)).then(loadLib));
  if (webglOk()) {
    loadLibRetry().then((maplibregl) => {
      if (dead) return;
      map = new maplibregl.Map({
        container: planetEl,
        style: style(),
        center: [-30, TILT_LAT],
        zoom: 1,
        attributionControl: false,
        fadeDuration: 0,
        dragRotate: false,
        pitchWithRotate: false,
        boxZoom: false,
        maxZoom: 6,
        pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
      });
      // Handlers exist but stay off until map mode turns them on.
      MAP_HANDLERS.forEach((h) => map[h] && map[h].disable());
      // queryRenderedFeatures doesn't report circles on the globe, so hit
      // test by hand: the nearest troll on the facing side within a finger.
      map.on("mousemove", (e) => { if (mapMode) planetEl.classList.toggle("is-pin", !!pinAt(e.point, 14)); });
      map.on("click", (e) => {
        if (!mapMode) return;
        // Picking a spot for your own pin: every tap is a spot, not a troll.
        if (picker) { picker({ lat: e.lngLat.lat, lng: e.lngLat.lng }, e.point); return; }
        if (!mapMode.onPin) return;
        const hit = pinAt(e.point, 22);
        mapMode.onPin(hit ? hit.pin : null, hit ? hit.at : e.point);
      });
      map.on("style.load", () => {
        map.setProjection({ type: "globe" });
        // Our own limb glow replaces MapLibre's blue atmosphere.
        if (map.setSky) map.setSky({ "atmosphere-blend": 0 });
        try { map.addImage("crust", crustImage()); map.setPaintProperty("land", "fill-pattern", "crust"); } catch {}
        fitZoom();
        map.once("idle", () => planetEl.classList.add("is-ready"));
      });
      map.on("error", (e) => console.warn("[menu-globe]", e && e.error ? e.error.message : e));
      refreshPins();
    }).catch((e) => console.warn("[menu-globe]", e.message));
  }

  function pinAt(point, maxPx) {
    const c = map.getCenter();
    const rad = Math.PI / 180;
    let best = null;
    for (const pin of pins) {
      // Skip the far side of the planet (angular distance from the centre).
      const cosd = Math.sin(c.lat * rad) * Math.sin(pin.lat * rad) + Math.cos(c.lat * rad) * Math.cos(pin.lat * rad) * Math.cos((pin.lng - c.lng) * rad);
      if (cosd < 0.15) continue;
      const at = map.project([pin.lng, pin.lat]);
      const d = Math.hypot(at.x - point.x, at.y - point.y);
      if (d <= maxPx && (!best || d < best.d)) best = { pin, at, d };
    }
    return best;
  }

  // Where the trolls are: the average of every pin as a point on the
  // sphere, so map mode opens facing them instead of wherever the spin left
  // the planet (two pins on opposite sides of the Atlantic both show).
  function pinsCentre() {
    if (!pins.length) return null;
    const rad = Math.PI / 180;
    let x = 0, y = 0, z = 0;
    for (const p of pins) {
      const la = p.lat * rad, lo = p.lng * rad;
      x += Math.cos(la) * Math.cos(lo); y += Math.cos(la) * Math.sin(lo); z += Math.sin(la);
    }
    const n = Math.hypot(x, y, z);
    if (n < 1e-6) return null;   // spread evenly round the planet: no side wins
    const lat = Math.asin(z / n) / rad, lng = Math.atan2(y, x) / rad;
    // Keep a little tilt toward the equator so the poles don't fill the view.
    return [lng, Math.max(-35, Math.min(45, lat))];
  }

  async function refreshPins() {
    const list = await loadPins();
    if (dead || !map) return pins;
    pins = list;
    const set = () => map.getSource("pins") && map.getSource("pins").setData(pinsGeo(pins));
    if (map.isStyleLoaded()) set(); else map.once("style.load", set);
    return pins;
  }

  // MapLibre's camera centres the globe in the padded area, so padding is
  // how the planet stays put while its box changes size.
  function paddingFor(cx, cy, w, h) {
    return {
      left: Math.max(0, 2 * cx - w), right: Math.max(0, w - 2 * cx),
      top: Math.max(0, 2 * cy - h), bottom: Math.max(0, h - 2 * cy),
    };
  }
  function zoomForRadius(r) {
    const now = limbRadius();
    return now > 1 ? map.getZoom() + Math.log2(r / now) : map.getZoom();
  }
  const settle = () => new Promise((res) => {
    let done = false;
    const end = () => { if (!done) { done = true; res(); } };
    map.once("moveend", end);
    setTimeout(end, 1600);
  });

  // inset: { left, bottom } px of screen the page's own UI covers, so the
  // live globe sits in the open part of the screen.
  async function enterMap({ onPin = null, inset = {} } = {}) {
    if (!map || mapMode || busy) return false;
    busy = true;
    const { w, h, px, py, pr } = geom;
    // Swap the planet's box to full screen without the globe moving...
    root.classList.add("is-swap", "is-map");
    map.resize();
    map.jumpTo({ padding: paddingFor(px, py, w, h) });
    map.setZoom(zoomForRadius(pr));
    root.classList.remove("is-swap");
    // ...then ease it into the open area, big.
    const left = inset.left || 0, bottom = inset.bottom || 0;
    const aw = w - left, ah = h - bottom;
    const cx = left + aw / 2, cy = ah / 2;
    const target = Math.min(aw, ah) * 0.44;
    const pad = paddingFor(cx, cy, w, h);
    // Measure the zoom where the camera will end up: the globe's size at a
    // given zoom changes with the latitude it is centred on.
    const from = { padding: paddingFor(px, py, w, h), center: map.getCenter(), zoom: map.getZoom() };
    const face = pinsCentre() || [from.center.lng, from.center.lat];
    map.jumpTo({ padding: pad, center: face });
    const z = zoomForRadius(target);
    map.jumpTo(from);
    map.easeTo({ padding: pad, zoom: z, center: face, duration: still ? 0 : 900 });
    await settle();
    MAP_HANDLERS.forEach((k) => map[k] && map[k].enable());
    map.setMinZoom(Math.max(0, z - 0.6));
    mapMode = { onPin, inset };
    busy = false;
    refreshPins();
    return true;
  }

  async function exitMap() {
    if (!map || !mapMode || busy) return false;
    busy = true;
    MAP_HANDLERS.forEach((k) => map[k] && map[k].disable());
    mapMode = null;
    planetEl.classList.remove("is-pin");
    setPicker(null);
    setDraft(null);
    map.setMinZoom(0);
    const { w, h, px, py, pr } = geom;
    const pad = paddingFor(px, py, w, h);
    const keep = { center: map.getCenter(), zoom: map.getZoom(), padding: map.getPadding() };
    map.jumpTo({ padding: pad, center: [keep.center.lng, TILT_LAT] });
    const z = zoomForRadius(pr);
    map.jumpTo(keep);
    map.easeTo({ padding: pad, zoom: z, center: [keep.center.lng, TILT_LAT], duration: still ? 0 : 800 });
    await settle();
    root.classList.add("is-swap");
    root.classList.remove("is-map");
    map.resize();
    map.jumpTo({ padding: { left: 0, right: 0, top: 0, bottom: 0 } });
    fitZoom();
    root.classList.remove("is-swap");
    busy = false;
    run();
    return true;
  }

  function flyTo(lat, lng, zoom = 4) {
    if (!map || !mapMode) return;
    map.flyTo({ center: [lng, lat], zoom, duration: still ? 0 : 1600, essential: true });
  }

  function setPicker(fn) {
    picker = fn || null;
    planetEl.classList.toggle("is-picking", !!picker);
  }
  function setDraft(spot) {
    draft = spot && Number.isFinite(spot.lat) && Number.isFinite(spot.lng) ? { lat: spot.lat, lng: spot.lng } : null;
    if (!map) return;
    const set = () => map.getSource("draft") && map.getSource("draft").setData(pinsGeo(draft ? [draft] : []));
    if (map.isStyleLoaded()) set(); else map.once("style.load", set);
  }

  return {
    get map() { return map; },
    get pins() { return pins; },
    get isMap() { return !!mapMode; },
    // setPicker(fn): while set, map-mode taps pick a spot instead of a
    // troll. setDraft({ lat, lng } | null): marks the picked spot.
    enterMap, exitMap, flyTo, refreshPins, setPicker, setDraft,
    pause() { paused = true; if (raf) cancelAnimationFrame(raf); raf = 0; root.style.visibility = "hidden"; },
    resume() { paused = false; root.style.visibility = ""; run(); },
    destroy() { dead = true; ro.disconnect(); if (raf) cancelAnimationFrame(raf); if (map) map.remove(); map = null; root.remove(); },
  };
}
