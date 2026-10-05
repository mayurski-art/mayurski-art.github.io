// Troll Forces asset cache (user, 2026-10-04: "is there a way for maps to be
// downloaded just once ... i dont want to wait every day").
//
// GitHub Pages tells browsers to recheck every file after 10 minutes, so
// each day's first match re-fetched (or at least re-asked about) every
// model and texture on the map. This keeps them in the browser's Cache
// Storage instead: the first load of a map downloads it, every later one
// reads it off the disk.
//
// Only Troll Forces' art and models, and three.js, go through here.
// Everything else on the site, the pages themselves included, is left to
// the network exactly as before (no respondWith).
//
//   Models, textures, images, three.js: served from the cache straight
//     away. Once a day a copy is re-checked in the background, so an
//     updated model shows up on the load after it changes.
//   Game scripts with a ?v= tag: always asked of the network (a 304 when
//     unchanged), the stored copy used only offline; older tags of the same
//     file are dropped as new ones arrive (the newest 3 kept).
//
// Registered from game.js. Off on localhost unless ?sw=1, so editing the
// game locally never serves a stale file; ?sw=0 removes it.

const CACHE = "tf-assets-v1";
const RECHECK_MS = 24 * 60 * 60 * 1000;
const STAMP = "x-tf-cached-at";
const KEEP_TAGS = 3;            // builds of one script kept at once

const GAME = "/assets/games/troll-ops/";
const VENDOR = "/assets/vendor/";
const ART = /\.(glb|gltf|bin|jpe?g|png|webp|avif|gif|svg|ktx2|hdr)$/i;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("tf-assets-") && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

function kindOf(req) {
  if (req.method !== "GET" || req.headers.has("range")) return null;
  const u = new URL(req.url);
  if (u.origin !== self.location.origin) return null;
  const p = u.pathname;
  if (p.startsWith(VENDOR) && /\.js$/.test(p)) return "art";
  if (!p.startsWith(GAME) || p.includes("/refs/")) return null;
  if (ART.test(p)) return "art";
  if (/\.(js|css)$/.test(p) && u.searchParams.has("v")) return "tagged";
  return null;
}

/* From the page: files it fetched before this worker was running (the first
   visit). Stored if they're ours and not stored yet; the browser's HTTP
   cache usually still has them, so this rarely touches the network. */
self.addEventListener("message", (e) => {
  if (e.data?.type !== "cache-urls" || !Array.isArray(e.data.urls)) return;
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    for (const url of e.data.urls.slice(0, 2000)) {
      let req;
      try { req = new Request(url); } catch { continue; }
      const kind = kindOf(req);
      if (!kind || await cache.match(req)) continue;
      await store(cache, req, kind, null).catch(() => {});
    }
  })());
});

self.addEventListener("fetch", (e) => {
  const kind = kindOf(e.request);
  if (!kind) return;
  e.respondWith(serve(e, kind));
});

async function serve(e, kind) {
  const req = e.request;
  let cache;
  try { cache = await caches.open(CACHE); } catch { return fetch(req); }
  // Scripts: network first, the cache only when offline. Trusting the ?v=
  // tag served an edited progression.js under its old tag forever, and with
  // it a weapons.js from before the Soul Blazer, so the new gun stayed
  // locked (user, 2026-10-05: "when i make new weapons going forward i dont
  // want this bug to happen again"). The server answers an unchanged script
  // with a tiny 304, so this costs nothing like the maps would.
  if (kind === "tagged") {
    try {
      const res = await fetch(req, { cache: "no-cache" });
      if (res.ok && res.type === "basic") e.waitUntil(store(cache, req, kind, null, res.clone()).catch(() => {}));
      return res;
    } catch (err) {
      const hit = await cache.match(req).catch(() => null);
      if (hit) return hit;
      throw err;
    }
  }
  const hit = await cache.match(req).catch(() => null);
  if (hit) {
    if (kind === "art") {
      const at = +hit.headers.get(STAMP) || 0;
      if (Date.now() - at > RECHECK_MS) e.waitUntil(store(cache, req, kind, "no-cache").catch(() => {}));
    }
    return hit;
  }
  const res = await fetch(req);
  if (res.ok && res.type === "basic") e.waitUntil(store(cache, req, kind, null, res.clone()).catch(() => {}));
  return res;
}

/* Puts a fresh copy in, stamped with when it was fetched. `res` is one
   already in hand; otherwise it is fetched (`mode`: the HTTP cache mode,
   "no-cache" = ask the server whether it changed). */
async function store(cache, req, kind, mode, res = null) {
  if (!res) {
    res = await fetch(req.url, mode ? { cache: mode } : {});
    if (!res.ok || res.type !== "basic") return;
  }
  const headers = new Headers(res.headers);
  headers.set(STAMP, String(Date.now()));
  const body = await res.blob();
  await cache.put(req.url, new Response(body, { status: res.status, statusText: res.statusText, headers }));
  if (kind === "tagged") {
    // Older builds of this same script are never asked for again: keep the
    // newest few. Not just one, since a few files are imported under two
    // tags at once (movement.js, dragonfire.js), and those would evict each
    // other on every load.
    const u = new URL(req.url);
    const same = [];
    for (const k of await cache.keys()) {
      if (new URL(k.url).pathname !== u.pathname) continue;
      const r = await cache.match(k);
      same.push({ k, at: +r?.headers.get(STAMP) || 0 });
    }
    same.sort((a, b) => b.at - a.at);
    for (const { k } of same.slice(KEEP_TAGS)) await cache.delete(k);
  }
}
