// Troll Forces in-game radio: the Grinspace widget (play, seek, EQ, shuffle),
// usable from the lobby and carried into the match (music.js).

import { EQ_BANDS, EQ_RANGE } from "../music.js?v=to-gs1";
import { game } from "../core/state.js?v=st1";

// In-game radio — the "Grinspace" skin (old Media Player Headspace, but the
// head is the trollface). A separate playlist from Troll Radio, usable from
// the lobby and carried straight through into the match (see music.js).
export function initRadioWidget() {
  const $ = (id) => document.getElementById(id);
  const toggle = $("to-radio-toggle");
  const panel = $("to-radio-panel");
  if (!toggle || !panel) return;
  const titleEl = $("to-radio-title");
  const artistEl = $("to-radio-artist");
  const playBtn = $("to-radio-play");
  const prevBtn = $("to-radio-prev");
  const nextBtn = $("to-radio-next");
  const stopBtn = $("to-radio-stop");
  const shuffleBtn = $("to-radio-shuffle");
  const volume = $("to-radio-volume");
  const balance = $("to-radio-balance");
  const seek = $("to-radio-seek");
  const timeEl = $("to-radio-time");
  const list = $("to-radio-list");
  const eqBox = $("to-radio-eq");
  const viz = $("to-radio-viz");
  const vctx = viz.getContext("2d");

  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  // Playlist rows, built once from the track list.
  const rows = game.music.tracks.map((t, i) => {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.innerHTML = `<span></span><small></small>`;
    b.firstChild.textContent = t.title;
    b.lastChild.textContent = t.artist;
    b.setAttribute("aria-label", `Play ${t.title} by ${t.artist}`);
    b.addEventListener("click", () => game.music.playIndex(i));
    li.append(b);
    list.append(li);
    return b;
  });

  // Ten EQ sliders (vertical), labelled like the original.
  const eqInputs = EQ_BANDS.map((hz, i) => {
    const lab = document.createElement("label");
    const inp = document.createElement("input");
    inp.type = "range";
    inp.min = -EQ_RANGE; inp.max = EQ_RANGE; inp.step = 1;
    inp.value = game.music.eq[i];
    const name = hz >= 1000 ? `${hz / 1000}K` : String(hz);
    inp.setAttribute("aria-label", `${name} hertz`);
    inp.addEventListener("input", () => game.music.setEq(i, Number(inp.value)));
    const cap = document.createElement("span");
    cap.textContent = name;
    lab.append(inp, cap);
    eqBox.append(lab);
    return inp;
  });
  $("to-radio-eqreset").addEventListener("click", () => {
    game.music.resetEq();
    eqInputs.forEach((inp) => { inp.value = 0; });
  });

  const repaint = () => {
    const t = game.music.current;
    titleEl.textContent = t ? t.title : (game.music.hasTracks ? "—" : "No tracks loaded");
    artistEl.textContent = t ? `· ${t.artist}` : "";
    panel.classList.toggle("is-playing", game.music.playing);
    playBtn.setAttribute("aria-label", game.music.playing ? "Pause" : "Play");
    shuffleBtn.classList.toggle("is-active", game.music.shuffle);
    shuffleBtn.setAttribute("aria-pressed", String(game.music.shuffle));
    const cur = game.music.tracks.indexOf(t);
    rows.forEach((b, i) => {
      if (i === cur) b.setAttribute("aria-current", "true");
      else b.removeAttribute("aria-current");
    });
  };
  game.music.onchange = repaint;

  // Waterfall visualiser: the last N spectra stacked into a tilted sheet of
  // dots, red at the front fading to blue at the back, like the original.
  const BINS = 32, DEPTH = 26;
  const history = [];
  const freq = new Uint8Array(128);
  let raf = 0, idleT = 0, bassAvg = 0, seeking = false;

  const draw = () => {
    raf = requestAnimationFrame(draw);
    const a = game.music.playing ? game.music.analyser : null;
    const row = new Float32Array(BINS);
    if (a) {
      a.getByteFrequencyData(freq);
      // Log-ish spread so the bass doesn't eat the whole sheet.
      for (let b = 0; b < BINS; b++) {
        const lo = Math.floor(Math.pow(b / BINS, 1.6) * 100);
        const hi = Math.max(lo + 1, Math.floor(Math.pow((b + 1) / BINS, 1.6) * 100));
        let m = 0;
        for (let k = lo; k < hi; k++) m = Math.max(m, freq[k]);
        row[b] = m / 255;
      }
    } else {
      idleT += 0.02;
      for (let b = 0; b < BINS; b++) row[b] = 0.05 + 0.04 * Math.sin(idleT + b * 0.4);
    }
    history.unshift(row);
    if (history.length > DEPTH) history.pop();

    // Speaker pods kick on bass hits: only the jump above the running
    // average counts, or bass-heavy tracks just leave them swollen.
    const bass = a ? (row[0] + row[1] + row[2]) / 3 : 0;
    bassAvg += (bass - bassAvg) * 0.08;
    const kick = Math.min(1, Math.max(0, (bass - bassAvg) * 7));
    panel.style.setProperty("--kick", kick.toFixed(3));

    const W = viz.width, H = viz.height;
    vctx.fillStyle = "#000";
    vctx.fillRect(0, 0, W, H);
    for (let r = history.length - 1; r >= 0; r--) {
      const d = r / DEPTH;                 // 0 front, 1 back
      const s = 1 - d * 0.55;              // perspective shrink
      const x0 = W * 0.16 + d * W * 0.32;
      const y0 = H * 0.86 - d * H * 0.52;
      const span = W * 0.62 * s;
      const hue = 0 + d * 240;             // red -> blue
      vctx.fillStyle = `hsl(${hue} 95% ${58 - d * 12}%)`;
      const h = history[r];
      for (let b = 0; b < BINS; b++) {
        const x = x0 + (b / (BINS - 1)) * span - d * 30;
        const y = y0 - h[b] * H * 0.42 * s + (b / BINS) * H * 0.12;
        vctx.fillRect(x, y, 2.4 * s + 0.6, 2.4 * s + 0.6);
      }
    }

    const dur = game.music.duration;
    if (!seeking) seek.value = dur ? Math.round((game.music.time / dur) * 1000) : 0;
    timeEl.textContent = dur ? `${fmt(game.music.time)} / ${fmt(dur)}` : fmt(game.music.time);
  };

  const setOpen = (open) => {
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    cancelAnimationFrame(raf);
    raf = 0;
    if (open) draw();               // only spends frames while it's on screen
  };

  toggle.addEventListener("click", () => setOpen(panel.hidden));
  $("to-radio-close").addEventListener("click", () => { setOpen(false); toggle.focus(); });
  panel.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.stopPropagation(); setOpen(false); toggle.focus(); }
  });
  playBtn.addEventListener("click", () => game.music.toggle());
  stopBtn.addEventListener("click", () => game.music.stop());
  prevBtn.addEventListener("click", () => game.music.prev());
  nextBtn.addEventListener("click", () => game.music.next());
  shuffleBtn.addEventListener("click", () => game.music.setShuffle(!game.music.shuffle));
  volume.value = Math.round(game.music.volume * 100);
  volume.addEventListener("input", () => game.music.setVolume(volume.value / 100));
  balance.value = Math.round(game.music.balance * 100);
  balance.addEventListener("input", () => game.music.setBalance(balance.value / 100));
  seek.addEventListener("input", () => { seeking = true; });
  seek.addEventListener("change", () => {
    game.music.seek((seek.value / 1000) * game.music.duration);
    seeking = false;
  });

  if (!game.music.hasTracks) {
    for (const b of [playBtn, prevBtn, nextBtn, stopBtn, shuffleBtn, seek]) b.disabled = true;
  }

  repaint();

  // Music is opt-in: nothing plays until the player hits Play. Whatever state
  // they leave it in on the menu (playing or paused) carries into the match.
}
