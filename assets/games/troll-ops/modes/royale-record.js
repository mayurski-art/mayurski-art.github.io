// Troll Royale: "Record my match" (opt-in; the menu row sits under the modes
// while Troll Royale is picked, menu/menu-bo2.js). The game canvas, and the
// game's own sound when there is any, from the green light (the ramp coming
// down, so the jump and the drop are in it) until you die or the match ends,
// whichever comes first. The clip is offered on the results screen and in
// the Esc menu (Save recording, a .webm download), and is freed when the next
// match starts. Only the 3D view is filmed: the HUD is page elements, not
// canvas, so the clip is clean footage. Browsers without canvas capture or
// MediaRecorder never see the option.

import { game } from "../core/state.js?v=st1";

const PREF_KEY = "trollops:royaleRecord";
const FPS = 30;
const VIDEO_BPS = 4_000_000;   // ~30 MB a minute: a full 14-minute match stays under half a gig
const TYPES_AV = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
const TYPES_V = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];

let rec = null;    // { recorder, chunks, stream, tap, mime, startedAt, stopReason }
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
function clipName(d) {
  return `troll-royale-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.webm`;
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
  let stream;
  try { stream = canvas.captureStream(FPS); } catch { return; }
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
  const r = { recorder, chunks: [], stream, tap, mime: recorder.mimeType || mime || "video/webm", startedAt: new Date(), stopReason: null };
  recorder.ondataavailable = (e) => { if (e.data && e.data.size) r.chunks.push(e.data); };
  recorder.onstop = () => finish(r);
  recorder.onerror = () => { if (rec === r) stopRoyaleRecord("error"); };
  try { recorder.start(1000); } catch { untap(tap); stopTracks(stream); return; }
  rec = r;
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
  const blob = new Blob(r.chunks, { type: (r.mime || "video/webm").split(";")[0] });
  r.chunks = [];
  if (!blob.size) return;
  freeClip();
  clip = { blob, url: URL.createObjectURL(blob), name: clipName(r.startedAt), reason: r.stopReason, size: blob.size };
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
    b.title = "Download this match's clip (.webm)";
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
    mime: rec?.mime || null, clip: clip ? { name: clip.name, size: clip.size, reason: clip.reason, type: clip.blob.type, url: clip.url } : null,
    buttons: buttons.map((b) => ({ hidden: b.hidden, inGameover: !!b.closest("#to-gameover"), inPause: !!b.closest("#to-pause") })),
  };
}
if (typeof location !== "undefined" && /[?&]tohooks=1/.test(location.search)) {
  window.__trollRoyaleRecord = { royaleRecordState, stopRoyaleRecord, saveRoyaleClip, setRecordPref, recordPref, recordSupported, clipBlob: () => clip?.blob || null };
}
