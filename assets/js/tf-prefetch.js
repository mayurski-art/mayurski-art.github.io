// Troll Forces prefetch for the trollrunner.net home: while someone is on the
// site, quietly pull the game's code and its menu's files into the browser
// cache, so opening Troll Forces doesn't wait on the network. Map files are
// NOT prefetched any more (user, 2026-10-03: maps load after Find Match, for
// that map only, behind troll-ops/map-load-screen.js).
//
// - The JS is found by crawling the live module graph from troll-ops.html, so
//   it always fetches the exact ?v= tags the game will ask for.
// - Models, textures and music come from troll-ops/prefetch-manifest.json,
//   grouped by map; only "lobby" (what the menu itself loads) is used.
// - Data saver and 2g get nothing.
// - Idle, low priority, a couple of requests at a time, at most once per
//   browser session.

const ROOT = new URL("../../", import.meta.url);           // the site root
const GAME = new URL("troll-ops.html", ROOT);
const MANIFEST = new URL("assets/games/troll-ops/prefetch-manifest.json", ROOT);
const DONE_KEY = "tf-prefetch:done";
const PARALLEL = 3;

function allowed() {
  try { if (sessionStorage.getItem(DONE_KEY)) return null; } catch { /* private mode: carry on */ }
  const c = navigator.connection;
  if (c?.saveData || /(^|-)2g$/.test(c?.effectiveType || "")) return null;
  const small = matchMedia("(pointer: coarse)").matches || (navigator.deviceMemory && navigator.deviceMemory < 4) || c?.effectiveType === "3g";
  return small ? "lite" : "full";
}

const get = (url) => fetch(url, { priority: "low", credentials: "same-origin" }).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
const getText = (url) => fetch(url, { priority: "low", credentials: "same-origin" }).then((r) => (r.ok ? r.text() : "")).catch(() => "");

/* Fetch `urls` a few at a time, yielding to the page between batches. */
async function drain(urls) {
  const queue = [...urls];
  const worker = async () => {
    while (queue.length) {
      if (document.hidden) await new Promise((r) => setTimeout(r, 1000));
      await get(queue.shift());
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, worker));
}

/* Every module the game imports, statically or dynamically, from its entry
   points, resolved through the page's import map. */
async function crawlGame() {
  const html = await getText(GAME);
  if (!html) return [];
  const map = (() => {
    const m = html.match(/<script type="importmap">([\s\S]*?)<\/script>/);
    try { return m ? JSON.parse(m[1]).imports || {} : {}; } catch { return {}; }
  })();
  const resolve = (spec, base) => {
    if (/^(\.|\/)/.test(spec)) return new URL(spec, base);
    for (const [k, v] of Object.entries(map)) {
      if (spec === k) return new URL(v, GAME);
      if (k.endsWith("/") && spec.startsWith(k)) return new URL(v + spec.slice(k.length), GAME);
    }
    return null;   // a bare name nobody maps, or a URL elsewhere
  };
  const entries = [...html.matchAll(/<(?:script[^>]+src|link[^>]+href)="(assets\/games\/troll-ops\/[^"]+)"/g)].map((m) => new URL(m[1], GAME));
  const seen = new Set();
  const out = [];
  const visit = async (url) => {
    if (!url || url.origin !== ROOT.origin || seen.has(url.href)) return;
    seen.add(url.href);
    out.push(url.href);
    if (!/\.m?js$/.test(url.pathname)) { await get(url); return; }   // the stylesheet
    const src = await getText(url);   // this fetch is the prefetch for this file
    const specs = [
      ...src.matchAll(/\bfrom\s*["']([^"']+)["']/g),
      ...src.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g),
      ...src.matchAll(/^\s*import\s*["']([^"']+)["']/gm),
    ].map((m) => m[1]);
    await Promise.all(specs.map((s) => visit(resolve(s, url))));
  };
  await Promise.all(entries.map(visit));
  return out;
}

async function run(mode) {
  await crawlGame();
  let manifest = null;
  try { manifest = JSON.parse(await getText(MANIFEST)); } catch { /* no manifest: code only */ }
  if (manifest) {
    await drain((manifest.lobby || []).map((p) => new URL(p, ROOT).href));
  }
  try { sessionStorage.setItem(DONE_KEY, "1"); } catch { /* fine */ }
}

/* Start a few seconds after the page has settled, when the browser is idle. */
export function startTrollForcesPrefetch() {
  const mode = allowed();
  if (!mode) return;
  // The timeout matters: the home's planet animates every frame, so the
  // browser may never call an idle callback that doesn't have one.
  const idle = window.requestIdleCallback ? (f) => requestIdleCallback(f, { timeout: 5000 }) : (f) => setTimeout(f, 200);
  const go = () => idle(() => run(mode));
  const later = () => setTimeout(go, 4000);
  if (document.readyState === "complete") later();
  else addEventListener("load", later, { once: true });
}
