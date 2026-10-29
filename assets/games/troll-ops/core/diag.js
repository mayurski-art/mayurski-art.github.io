// Troll Forces diagnostics (?diag=1). The user's iPhone shows the lobby
// with no pictures and Troll City with no buildings (2026-10-28), and no
// desktop browser here can reproduce it, so the phone reports for itself: a
// panel over the game listing the device, the service worker and its cache,
// WebGL, every picture in the menu (loaded or not), a fetch-and-decode test
// of each kind of file the game loads, and every load that failed or error
// logged since the page opened (troll-ops.html collects those in
// window.__tfDiag before anything else runs). Copy puts it all on the
// clipboard; Clear cache drops the asset cache and the worker and reloads.
// Nothing here runs without ?diag=1.

const log = (window.__tfDiag ||= []);
const short = (u) => String(u || "").replace(location.origin, "").replace(/^\/assets\/games\/troll-ops\//, "").slice(0, 90);

const panel = document.createElement("section");
panel.setAttribute("aria-label", "Diagnostics");
panel.style.cssText = "position:fixed;left:6px;top:calc(6px + env(safe-area-inset-top));width:min(560px,calc(100vw - 12px));max-height:calc(100vh - 12px - env(safe-area-inset-top));overflow:auto;z-index:2147483647;"
  + "background:rgba(4,8,20,.94);color:#dfe8ff;border:1px solid #4fd8ff;border-radius:10px;font:11px/1.4 ui-monospace,Menlo,Consolas,monospace;padding:8px 10px;-webkit-user-select:text;user-select:text";
panel.innerHTML = `<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;flex-wrap:wrap">
  <b style="font:800 13px system-ui;color:#4fd8ff;flex:1">Troll Forces diagnostics</b>
  <button type="button" data-act="tests">Run tests</button><button type="button" data-act="copy">Copy</button>
  <button type="button" data-act="clear">Clear cache</button><button type="button" data-act="min">Hide</button><button type="button" data-act="off">Turn off</button></div><pre style="margin:0;white-space:pre-wrap;word-break:break-all"></pre>`;
for (const b of panel.querySelectorAll("button")) b.style.cssText = "font:700 12px system-ui;padding:5px 9px;border-radius:7px;border:1px solid #4fd8ff;background:#13234f;color:#fff";
document.body.appendChild(panel);
const pre = panel.querySelector("pre");
let tests = ["(not run yet: Run tests)"];

async function swState() {
  const out = [];
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.();
    out.push(`service worker: ${navigator.serviceWorker ? (navigator.serviceWorker.controller ? "controlling" : "not controlling") : "unsupported"}${reg ? `, registered (${reg.active ? "active" : "not active"})` : ", none registered"}`);
  } catch (e) { out.push(`service worker: ${e.message}`); }
  try {
    const keys = await caches.keys();
    for (const k of keys) out.push(`cache ${k}: ${(await (await caches.open(k)).keys()).length} entries`);
    if (!keys.length) out.push("caches: none");
  } catch (e) { out.push(`caches: ${e.message}`); }
  try { const est = await navigator.storage?.estimate?.(); if (est) out.push(`storage: ${(est.usage / 1e6).toFixed(1)} MB used of ${(est.quota / 1e6).toFixed(0)} MB`); } catch {}
  return out;
}

function glState() {
  const out = [];
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    if (!gl) return ["webgl: none"];
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    out.push(`webgl: ${gl instanceof (window.WebGL2RenderingContext || Object) ? "2" : "1"}, ${dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)}, max texture ${gl.getParameter(gl.MAX_TEXTURE_SIZE)}`);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  } catch (e) { out.push(`webgl: ${e.message}`); }
  const canvases = [...document.querySelectorAll("canvas")].filter((c) => c.width * c.height > 0);
  const big = canvases.filter((c) => c.width * c.height > 200000);
  out.push(`canvases: ${canvases.length} (big: ${big.map((c) => `${c.id || c.className || "canvas"} ${c.width}x${c.height}`).join(", ") || "none"})`);
  const g = window.__trollOps, val = (v) => (typeof v === "function" ? v() : v);
  if (g) out.push(`game: state ${val(g.state)}, map ${val(g.loadedMapId) || "-"}, mode ${val(g.modeId) || "-"}`);
  return out;
}

function pictures() {
  const imgs = [...document.querySelectorAll("#to-title img, .to-bo2 img, .to-fn-bg img")];
  const bad = imgs.filter((i) => i.getAttribute("src") && !(i.complete && i.naturalWidth));
  const lines = [`pictures in the menu: ${imgs.length}, not showing: ${bad.length}`];
  for (const i of bad.slice(0, 14)) lines.push(`  x ${short(i.currentSrc || i.src)} (${i.complete ? "loaded, 0 wide: failed" : "still loading"})`);
  const vids = [...document.querySelectorAll("video")];
  for (const v of vids) lines.push(`video ${short(v.currentSrc || v.src)}: ready ${v.readyState}, ${v.error ? `error ${v.error.code}` : "no error"}`);
  return lines;
}

/* One file of each kind, fetched and decoded the way the game would. */
async function runTests() {
  const base = "assets/games/troll-ops/";
  const files = [
    ["map shot webp", "ui/maps/kabukigrin-1280.webp"], ["lobby still webp", "ui/lobby/trollcity-1-1280.webp"],
    ["png", "ui/trollface-sad.png"], ["jpg texture", "textures/wood_color.jpg"], ["glb model (Troll City)", "models/tc-town.glb"],
  ];
  const out = [];
  for (const [what, f] of files) {
    const t0 = performance.now();
    try {
      const r = await fetch(base + f);
      const b = await r.blob();
      let dec = "";
      if (/\.(webp|png|jpe?g)$/.test(f)) {
        const url = URL.createObjectURL(b);
        try { const im = new Image(); im.src = url; await im.decode(); dec = `, decodes ${im.naturalWidth}x${im.naturalHeight}`; }
        catch (e) { dec = `, DECODE FAILED (${e.name}: ${e.message})`; }
        try { const bm = await createImageBitmap(b); dec += `, bitmap ok`; bm.close?.(); } catch (e) { dec += `, BITMAP FAILED (${e.name})`; }
        URL.revokeObjectURL(url);
      }
      out.push(`${what}: ${r.status} ${b.type || "?"} ${(b.size / 1024).toFixed(0)} KB${dec} (${(performance.now() - t0).toFixed(0)} ms)`);
    } catch (e) { out.push(`${what}: FETCH FAILED ${e.name}: ${e.message}`); }
  }
  // the network straight (a fresh query string the worker doesn't key on still goes through it; cache: no-store skips the HTTP cache)
  try {
    const r = await fetch(base + "ui/maps/kabukigrin-1280.webp?diag=" + Date.now(), { cache: "no-store" });
    out.push(`map shot, no-store: ${r.status} ${(await r.blob()).size} bytes`);
  } catch (e) { out.push(`map shot, no-store: FAILED ${e.message}`); }
  const v = document.createElement("video");
  out.push(`video: webm vp9 "${v.canPlayType('video/webm; codecs="vp9"')}", mp4 "${v.canPlayType("video/mp4")}"`);
  tests = out;
  paint();
}

async function paint() {
  const lines = [
    `${new Date().toISOString()}  ${location.pathname}${location.search}`,
    `${navigator.userAgent}`,
    `screen ${innerWidth}x${innerHeight} @${devicePixelRatio}, memory ${navigator.deviceMemory ?? "?"} GB, cores ${navigator.hardwareConcurrency ?? "?"}, home screen app ${!!navigator.standalone || matchMedia("(display-mode: standalone)").matches}`,
    ...(await swState()), ...glState(), ...pictures(),
    "— tests —", ...tests,
    `— failed loads and errors (${log.length}) —`, ...log.slice(-40),
  ];
  pre.textContent = lines.join("\n");
}

panel.addEventListener("click", async (e) => {
  const act = e.target.closest("[data-act]")?.dataset.act;
  if (act === "tests") { tests = ["running…"]; paint(); runTests(); }
  else if (act === "copy") { try { await navigator.clipboard.writeText(pre.textContent); e.target.textContent = "Copied"; } catch { e.target.textContent = "Select the text"; } }
  else if (act === "min") { const hide = pre.style.display !== "none"; pre.style.display = hide ? "none" : ""; e.target.textContent = hide ? "Show" : "Hide"; }
  else if (act === "off") {
    // (Options > Diagnostics' saved switch, and ?diag=1 out of the address)
    try { localStorage.setItem("tf-diag", "0"); } catch {}
    location.replace(location.pathname + location.search.replace(/[?&]diag=1/, "").replace(/^&/, "?") + location.hash);
  }
  else if (act === "clear") {
    e.target.textContent = "Clearing…";
    try { for (const k of await caches.keys()) await caches.delete(k); } catch {}
    try { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); } catch {}
    location.reload();
  }
});
paint();
setInterval(paint, 2000);
runTests();
