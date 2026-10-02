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

async function loadPins() {
  const A = window.TrollrunnerAccounts;
  const sb = A && A.getClient && A.getClient();
  if (!sb) return [];
  try {
    const { data, error } = await sb.from("troll_locations_view").select("lat, lng").limit(5000);
    if (error) return [];
    return (data || []).filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
  } catch { return []; }
}

const pinsGeo = (pins) => ({
  type: "FeatureCollection",
  features: pins.map((p) => ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [p.lng, p.lat] } })),
});

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
      { id: "pin-glow", type: "circle", source: "pins",
        paint: { "circle-color": "#ff8a2a", "circle-radius": 10, "circle-blur": 1, "circle-opacity": 0.75 } },
      { id: "pin", type: "circle", source: "pins",
        paint: { "circle-color": "#fff4cc", "circle-radius": 2.4 } },
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
    if (map) { map.resize(); fitZoom(); }
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
    if (map) {
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

  if (webglOk()) {
    loadLib().then((maplibregl) => {
      if (dead) return;
      map = new maplibregl.Map({
        container: planetEl,
        style: style(),
        center: [-30, TILT_LAT],
        zoom: 1,
        interactive: false,
        attributionControl: false,
        fadeDuration: 0,
        pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
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
      loadPins().then((pins) => {
        if (dead || !map || !pins.length) return;
        const set = () => map.getSource("pins") && map.getSource("pins").setData(pinsGeo(pins));
        if (map.isStyleLoaded()) set(); else map.once("style.load", set);
      });
    }).catch((e) => console.warn("[menu-globe]", e.message));
  }

  return {
    get map() { return map; },
    pause() { paused = true; if (raf) cancelAnimationFrame(raf); raf = 0; root.style.visibility = "hidden"; },
    resume() { paused = false; root.style.visibility = ""; run(); },
    destroy() { dead = true; ro.disconnect(); if (raf) cancelAnimationFrame(raf); if (map) map.remove(); map = null; root.remove(); },
  };
}
