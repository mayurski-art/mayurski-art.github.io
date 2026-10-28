// Troll Royale: "Record my match" (opt-in; the menu row sits under the modes
// while Troll Royale is picked, menu/menu-bo2.js). The game canvas, and the
// game's own sound when there is any, from the green light (the ramp coming
// down, so the jump and the drop are in it) until you die or the match ends,
// whichever comes first. The clip is offered on the results screen and in
// the Esc menu (Save recording, an .mp4 or .webm download), and is freed
// when the next match starts. The 3D view is filmed, plus the sniper scope (the one HUD
// layer that IS the view: the gun hides under it); the rest of the HUD is
// page elements and stays out, so the clip is clean footage. Browsers
// without canvas capture or MediaRecorder never see the option.
//
// Each frame the game draws is copied onto a recording canvas of a fixed
// size (the window's, up to 1080p), so the clip stays sharp and one size
// when the game's dynamic resolution steps down. H.264 first: browsers
// encode it on the GPU, where VP9 is software and cost the game enough
// frames that auto quality fell to its lowest while filming.

import { game } from "../core/state.js?v=st1";

const PREF_KEY = "trollops:royaleRecord";
const FPS = 60;
const MAX_W = 1920, MAX_H = 1080;
const VIDEO_BPS = 8_000_000;   // ~60 MB a minute at 1080p60
const TYPES_AV = ["video/mp4;codecs=avc1.640028,mp4a.40.2", "video/webm;codecs=vp8,opus", "video/webm;codecs=vp9,opus", "video/webm"];
const TYPES_V = ["video/mp4;codecs=avc1.640028", "video/webm;codecs=vp8", "video/webm;codecs=vp9", "video/webm"];

let rec = null;    // { recorder, chunks, stream, tap, mime, startedAt, stopReason, out, unhook }
let clip = null;   // { blob, url, name, reason, size }
let triedThisMatch = false;
let lastState = null;
let watch = 0;
const buttons = [];
let dot = null;

function pickType(list) {
  try { return list.find((t) => MediaRecorder.isTypeSupported(t)) || null; } catch { return null; }
}

export function recordSupported() {
  return typeof window !== "undefined" && typeof window.MediaRecorder === "function"
    && typeof HTMLCanvasElement !== "undefined" && typeof HTMLCanvasElement.prototype.captureStream === "function"
    && !!pickType(TYPES_V);
}

export function recordPref() {
  try { return localStorage.getItem(PREF_KEY) === "1"; } catch { return false; }
}
export function setRecordPref(on) {
  try { on ? localStorage.setItem(PREF_KEY, "1") : localStorage.removeItem(PREF_KEY); } catch {}
}

const pad = (n) => String(n).padStart(2, "0");
function clipName(d, mime) {
  const ext = /mp4/.test(mime || "") ? "mp4" : "webm";
  return `troll-royale-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.${ext}`;
}

/* The recording canvas: the window's size at the screen's pixel ratio
   (at most 2), fitted inside 1080p, even sides for the encoder. */
function outSize(canvas) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = (canvas.clientWidth || canvas.width) * dpr, h = (canvas.clientHeight || canvas.height) * dpr;
  const k = Math.min(1, MAX_W / w, MAX_H / h);
  return { w: Math.max(2, Math.round(w * k / 2) * 2), h: Math.max(2, Math.round(h * k / 2) * 2) };
}

/* Copy the frame the game just drew. Called right after the draw to the
   screen, in the same task, so the WebGL canvas still holds it. */
function drawFrame(r) {
  const now = performance.now();
  if (now - r.lastAt < 1000 / FPS - 2) return;
  r.lastAt = now;
  const { ctx, canvas: out, track } = r.out;
  const src = game.renderer.domElement;
  const W = out.width, H = out.height;
  // contain: a window resized mid-match letterboxes rather than stretching
  const k = Math.min(W / src.width, H / src.height);
  const dw = src.width * k, dh = src.height * k;
  if (dw < W - 1 || dh < H - 1) { ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H); }
  ctx.drawImage(src, (W - dw) / 2, (H - dh) / 2, dw, dh);
  drawScope(ctx, W, H);
  track.requestFrame?.();
  r.frames = (r.frames || 0) + 1;
}

/* view/sniper-scope.js's overlay, drawn the same way: a round lens of
   98% of the short side, black outside, darkening to its rim, a thin
   crosshair with thick posts left, right and below, range ticks. */
let scopeEl = null;
function drawScope(ctx, W, H) {
  if (!scopeEl?.isConnected) scopeEl = document.querySelector(".to-scope");
  if (!scopeEl || scopeEl.style.display === "none" || !scopeEl.offsetParent) return;
  const k = parseFloat(scopeEl.style.opacity) || 0;
  if (k <= 0) return;
  const cx = W / 2, cy = H / 2, D = Math.min(W, H) * 0.98, R = D / 2, u = D / 200;
  ctx.save();
  ctx.globalAlpha = k;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.arc(cx, cy, R, 0, Math.PI * 2, true);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();
  // CSS radial-gradient(circle) reaches the square's corner, past the rim
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * Math.SQRT2);
  g.addColorStop(0, "rgba(140,170,200,0.05)");
  g.addColorStop(0.5, "rgba(0,0,0,0)");
  g.addColorStop(0.8, "rgba(0,0,0,0.45)");
  g.addColorStop(0.95, "rgba(0,0,0,0.95)");
  g.addColorStop(1, "#000");
  ctx.fillStyle = g;
  ctx.fillRect(cx - R, cy - R, D, D);
  ctx.strokeStyle = "#050505";
  ctx.lineCap = "butt";
  const line = (x1, y1, x2, y2, w) => {
    ctx.lineWidth = w * u;
    ctx.beginPath();
    ctx.moveTo(cx + x1 * u, cy + y1 * u);
    ctx.lineTo(cx + x2 * u, cy + y2 * u);
    ctx.stroke();
  };
  line(-100, 0, 100, 0, 0.32);
  line(0, -100, 0, 100, 0.32);
  line(-100, 0, -40, 0, 2.4);
  line(100, 0, 40, 0, 2.4);
  line(0, 100, 0, 40, 2.4);
  for (let d = 8; d <= 32; d += 8) {
    for (const s of [-1, 1]) {
      line(s * d, -1.6, s * d, 1.6, 0.32);
      line(-1.6, s * d, 1.6, s * d, 0.32);
    }
  }
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 1.2 * u;
  ctx.beginPath();
  ctx.arc(cx, cy, 99.4 * u, 0, Math.PI * 2);
  ctx.stroke();
  // the trollface reticle on the centre, when it's on (9% of the lens)
  const troll = scopeEl.querySelector(".to-scope-troll:not([hidden])");
  if (troll?.complete && troll.naturalWidth) {
    const tw = D * 0.09, th = tw * troll.naturalHeight / troll.naturalWidth;
    ctx.drawImage(troll, cx - tw / 2, cy - th / 2, tw, th);
  }
  ctx.restore();
}

/* After every draw to the screen (the composer's last pass), copy it. */
function hookRender(r) {
  const renderer = game.renderer;
  const raw = renderer.render;
  renderer.render = function (...args) {
    raw.apply(this, args);
    if (rec === r && this.getRenderTarget() === null) { try { drawFrame(r); } catch {} }
  };
  return () => { if (renderer.render !== raw) renderer.render = raw; };
}

/* A new Royale match (setupRoyale): drop last match's clip. */
export function royaleRecordReset() {
  if (rec) stopRoyaleRecord("reset");
  freeClip();
  triedThisMatch = false;
}

/* Called every Royale frame; starts once a match, the moment staging ends
   (the green light on Trollface Island, "DROP IN" elsewhere). */
export function royaleRecordTick() {
  if (triedThisMatch || game.isStaging()) return;
  triedThisMatch = true;
  if (!recordPref() || !recordSupported() || !game.player.alive) return;
  startRecord();
}

function startRecord() {
  const canvas = game.renderer?.domElement;
  if (!canvas) return;
  const size = outSize(canvas);
  const outCanvas = document.createElement("canvas");
  outCanvas.width = size.w;
  outCanvas.height = size.h;
  const ctx = outCanvas.getContext("2d", { alpha: false });
  if (!ctx || typeof outCanvas.captureStream !== "function") return;
  ctx.imageSmoothingQuality = "high";
  let stream;
  try { stream = outCanvas.captureStream(0); } catch { return; }   // a frame per game frame (requestFrame)
  const track = stream.getVideoTracks()[0];
  if (!track) return;
  // The game's sound: a tap off the master gain (sound/audio.js), so it's
  // what you hear, at your volume. The radio/music player runs its own
  // context and stays out.
  let tap = null;
  const a = game.audio;
  if (a?.ctx && a.master && typeof a.ctx.createMediaStreamDestination === "function") {
    try {
      tap = a.ctx.createMediaStreamDestination();
      a.master.connect(tap);
      for (const t of tap.stream.getAudioTracks()) stream.addTrack(t);
    } catch { tap = null; }
  }
  const mime = (tap && pickType(TYPES_AV)) || pickType(TYPES_V);
  let recorder;
  try { recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: VIDEO_BPS }); }
  catch {
    try { recorder = new MediaRecorder(stream); } catch { untap(tap); stopTracks(stream); return; }
  }
  const r = { recorder, chunks: [], stream, tap, mime: recorder.mimeType || mime || "video/webm", startedAt: new Date(), stopReason: null,
    out: { canvas: outCanvas, ctx, track, w: size.w, h: size.h }, lastAt: -Infinity, unhook: null };
  recorder.ondataavailable = (e) => { if (e.data && e.data.size) r.chunks.push(e.data); };
  recorder.onstop = () => finish(r);
  recorder.onerror = () => { if (rec === r) stopRoyaleRecord("error"); };
  try { recorder.start(1000); } catch { untap(tap); stopTracks(stream); return; }
  rec = r;
  r.unhook = hookRender(r);
  showDot(true);
  ensureWatch();
}

/* You died, or the match ended (a win, or the Cringe took the last two). */
export function stopRoyaleRecord(reason = "stop") {
  const r = rec;
  if (!r) return;
  rec = null;
  r.stopReason = reason;
  r.stoppedAt = performance.now();
  showDot(false);
  r.unhook?.();
  try { if (r.recorder.state !== "inactive") r.recorder.stop(); else finish(r); } catch { finish(r); }
  // the canvas track can go now; the recorder flushes what it already has
  for (const t of r.stream.getVideoTracks()) { try { t.stop(); } catch {} }
  untap(r.tap);
}

function finish(r) {
  if (r.done) return;
  r.done = true;
  stopTracks(r.stream);
  if (r.stopReason === "reset") return;
  const type = (r.mime || "video/webm").split(";")[0];
  const blob = new Blob(r.chunks, { type });
  r.chunks = [];
  if (!blob.size) return;
  freeClip();
  clip = { blob, url: URL.createObjectURL(blob), name: clipName(r.startedAt, type), reason: r.stopReason, size: blob.size };
  paintButtons();
  ensureWatch();
}

function untap(tap) {
  if (!tap) return;
  try { game.audio.master.disconnect(tap); } catch {}
}
function stopTracks(stream) {
  for (const t of stream?.getTracks?.() || []) { try { t.stop(); } catch {} }
}
function freeClip() {
  if (!clip) return;
  try { URL.revokeObjectURL(clip.url); } catch {}
  clip = null;
  paintButtons();
}

export function saveRoyaleClip() {
  if (!clip) return false;
  const a = document.createElement("a");
  a.href = clip.url;
  a.download = clip.name;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  return true;
}

/* Save buttons on the results screen and in the Esc menu, shown only while
   a clip is waiting. */
function paintButtons() {
  if (!buttons.length) makeButtons();
  for (const b of buttons) b.hidden = !clip;
}
function makeButtons() {
  const add = (before) => {
    if (!before?.parentNode) return;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "to-btn to-btn-ghost to-rec-save";
    b.textContent = "Save recording";
    b.title = "Download this match's clip";
    b.hidden = true;
    b.addEventListener("click", saveRoyaleClip);
    before.parentNode.insertBefore(b, before);
    buttons.push(b);
  };
  add(document.getElementById("to-retry-btn"));
  add(document.getElementById("to-quit-btn"));
}

/* A tiny red dot in the corner while filming: no words, no keys. */
function showDot(on) {
  if (on && !dot) {
    dot = document.createElement("div");
    dot.className = "to-rec-dot";
    dot.setAttribute("aria-hidden", "true");
    dot.style.cssText = "position:fixed;top:6px;left:6px;width:7px;height:7px;border-radius:50%;background:#e33;opacity:.75;z-index:60;pointer-events:none;box-shadow:0 0 3px rgba(0,0,0,.6)";
    document.body.appendChild(dot);
  }
  if (dot) dot.hidden = !on;
}

/* Left the match from the Esc menu while filming: stop there. Any other
   match starting frees the clip (a Royale one already did, in setupRoyale). */
function ensureWatch() {
  if (watch) return;
  lastState = game.gameState;
  watch = setInterval(() => {
    const s = game.gameState;
    if (rec && s === "menu") stopRoyaleRecord("left");
    if (clip && !rec && s === "playing" && (lastState === "menu" || lastState === "gameover")) freeClip();
    lastState = s;
    if (!rec && !clip) { clearInterval(watch); watch = 0; }
  }, 400);
}

/* For tests: ?tohooks=1 puts this module on window.__trollRoyaleRecord. */
export function royaleRecordState() {
  return {
    supported: recordSupported(), pref: recordPref(), recording: !!rec,
    mime: rec?.mime || null, size: rec ? { w: rec.out.w, h: rec.out.h } : null, frames: rec?.frames || 0, clip: clip ? { name: clip.name, size: clip.size, reason: clip.reason, type: clip.blob.type, url: clip.url } : null,
    buttons: buttons.map((b) => ({ hidden: b.hidden, inGameover: !!b.closest("#to-gameover"), inPause: !!b.closest("#to-pause") })),
  };
}
if (typeof location !== "undefined" && /[?&]tohooks=1/.test(location.search)) {
  window.__trollRoyaleRecord = { royaleRecordState, stopRoyaleRecord, saveRoyaleClip, setRecordPref, recordPref, recordSupported, clipBlob: () => clip?.blob || null,
    recCanvas: () => rec?.out.canvas || null };
}
