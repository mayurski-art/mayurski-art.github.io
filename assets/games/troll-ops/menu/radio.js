// Troll Forces in-game radio: play, seek, EQ, shuffle, playlist, usable from
// the lobby and carried into the match (music.js). The look is a skin
// (radio-skins.js): the girl radio or the male one, flipped with the round
// button by the red X and remembered. The station is named after the map and mode
// you're on ("Grin Beach FM · Team Deathmatch").

import { EQ_BANDS, EQ_RANGE } from "../sound/music.js?v=to-gs1-sg1-zr10-jb1-nh1-hl1-or1-hh1-yb1";
import { game } from "../core/state.js?v=st1";
import { SKINS, SKIN_IDS } from "./radio-skins.js?v=rs6-mg1";
import { MODES } from "../modes/modes.js?v=umb1-rn-wst-tl1-bs1-soc1-t69-u69b7b7d-wb1-ar1-ar2-zh1-fl1-or1-ffa1-dom1-gf1-tg1-kb9-sp1-gb2-tb1";
import { MAPS } from "../maps/maps.js?v=p5tc-k9-em1-wst-tl1-bs1-tl2-sb1-rp1-dj1-cr1-db1-sb2-db2a-db2b-db2c-db3-db4-db5-gj1-fu1b7b7dc1c2f1m1u-tc3-nc1-cd1-sh1-sg1-bw1-cw1-zr10-zh1-hr2-zp1-jb1-nh1-pi1-sr1-hl1-pf1-ub1-uw1-ug5-or1-bw2-bt1-wf1-wf2-zf1-bp1-is1-gf1-tg1-tcs1-kb0-kb1-kb2-kb3-cl1-kb4-kb5-kb6-kb7-kb8-kb9-kb10-kb11-ip1-tcs2-mg1-kb12-tm3-tm4-tm6-tm7-tcp1-tx1-trk1-bt2-bt3-ch1-jb3-jb6-sp1-hh1-yb1-kbt1-gb1-gb3-rh1-gb4-tb1-gb5";

const SKIN_KEY = "trollops:radio-skin";
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/* In a match: the map that's loaded. On the menu: the map Deploy would
   load for the picked mode. */
function station() {
  const inMatch = game.gameState && game.gameState !== "menu";
  let mapId = inMatch ? game.loadedMapId : null;
  if (!mapId) { try { mapId = game.matchMapId?.(); } catch { mapId = null; } }
  const map = MAPS[mapId]?.name;
  const mode = MODES[game.modeId]?.name || "";
  return { name: map ? `${map} FM` : "Troll Warfare FM", mode };
}

/* Track lengths aren't in the track list, so read each file's metadata once
   (a small ranged request) the first time the radio opens. */
const durations = [];
let durationsAsked = false;
function loadDurations(onDone) {
  if (durationsAsked) return;
  durationsAsked = true;
  game.music.tracks.forEach((t, i) => {
    const a = new Audio();
    a.preload = "metadata";
    a.addEventListener("loadedmetadata", () => {
      if (Number.isFinite(a.duration)) durations[i] = a.duration;
      a.removeAttribute("src");
      onDone();
    }, { once: true });
    a.src = t.src;
  });
}

export function initRadioWidget() {
  const toggle = document.getElementById("to-radio-toggle");
  const panel = document.getElementById("to-radio-panel");
  if (!toggle || !panel) return;

  let skin = "girl";
  try { if (SKIN_IDS.includes(localStorage.getItem(SKIN_KEY))) skin = localStorage.getItem(SKIN_KEY); } catch { /* private mode */ }

  let ui = null;        // the mounted skin's elements
  let raf = 0, idleT = 0, bassAvg = 0, seeking = false, stationT = 0;
  const BINS = 32, DEPTH = 26;
  const history = [];
  const freq = new Uint8Array(128);

  function paintStation() {
    const s = station();
    panel.querySelectorAll("[data-station]").forEach((el) => { el.textContent = s.name; });
    panel.querySelectorAll("[data-station-mode]").forEach((el) => { el.textContent = s.mode; });
    panel.setAttribute("aria-label", `${s.name} radio`);
  }

  function paintDurations() {
    if (!ui) return;
    ui.rows.forEach((b, i) => {
      const d = b.querySelector("time");
      if (d) d.textContent = durations[i] ? fmt(durations[i]) : "--:--";
    });
    const n = game.music.tracks.length;
    if (ui.count) ui.count.textContent = `${n} track${n === 1 ? "" : "s"}`;
    if (ui.total) {
      const known = durations.filter(Boolean);
      ui.total.textContent = known.length ? `${fmt(known.reduce((a, b) => a + b, 0))} total` : "";
    }
  }

  function repaint() {
    if (!ui) return;
    const m = game.music;
    const t = m.current;
    ui.title.textContent = t ? t.title : (m.hasTracks ? "—" : "No tracks loaded");
    ui.artist.textContent = t ? `· ${t.artist}` : "";
    panel.classList.toggle("is-playing", m.playing);
    ui.play.setAttribute("aria-label", m.playing ? "Pause" : "Play");
    ui.shuffle.classList.toggle("is-active", m.shuffle);
    ui.shuffle.setAttribute("aria-pressed", String(m.shuffle));
    if (ui.shufState) ui.shufState.textContent = m.shuffle ? "⇄ on" : "";
    const cur = m.tracks.indexOf(t);
    ui.rows.forEach((b, i) => {
      if (i === cur) b.setAttribute("aria-current", "true");
      else b.removeAttribute("aria-current");
    });
  }

  function mount(id) {
    skin = id;
    const def = SKINS[id];
    panel.className = `to-radio-panel ${def.cls}`;
    panel.dataset.skin = id;
    panel.innerHTML = def.html;
    const $ = (x) => panel.querySelector(`#${x}`);
    const fm = def.cls.includes("fm");

    // Art loads from data-src so a missing file can drop itself quietly.
    panel.querySelectorAll("img[data-src]").forEach((img) => {
      img.addEventListener("error", () => img.remove(), { once: true });
      img.src = img.dataset.src;
    });

    ui = {
      title: $("to-radio-title"), artist: $("to-radio-artist"), time: $("to-radio-time"),
      play: $("to-radio-play"), prev: $("to-radio-prev"), next: $("to-radio-next"),
      stop: $("to-radio-stop"), shuffle: $("to-radio-shuffle"), seek: $("to-radio-seek"),
      volume: $("to-radio-volume"), balance: $("to-radio-balance"),
      count: $("to-radio-count"), total: $("to-radio-total"), shufState: $("to-radio-shufstate"),
      viz: $("to-radio-viz"), rows: [], fm, colors: def.viz,
    };
    ui.vctx = ui.viz.getContext("2d");

    // Playlist rows.
    const list = $("to-radio-list");
    ui.rows = game.music.tracks.map((t, i) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.innerHTML = fm ? `<span></span><time></time>` : `<span></span><small></small>`;
      b.firstChild.textContent = fm ? `${String(i + 1).padStart(2, "0")}. ${t.title}` : t.title;
      if (!fm) b.lastChild.textContent = t.artist;
      b.setAttribute("aria-label", `Play ${t.title} by ${t.artist}`);
      b.addEventListener("click", () => game.music.playIndex(i));
      li.append(b);
      list.append(li);
      return b;
    });

    // Ten EQ sliders (vertical).
    const eqBox = $("to-radio-eq");
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

    $("to-radio-close").addEventListener("click", () => { setOpen(false); toggle.focus(); });
    ui.play.addEventListener("click", () => game.music.toggle());
    ui.stop.addEventListener("click", () => game.music.stop());
    ui.prev.addEventListener("click", () => game.music.prev());
    ui.next.addEventListener("click", () => game.music.next());
    ui.shuffle.addEventListener("click", () => game.music.setShuffle(!game.music.shuffle));
    ui.volume.value = Math.round(game.music.volume * 100);
    ui.volume.addEventListener("input", () => game.music.setVolume(ui.volume.value / 100));
    ui.balance.value = Math.round(game.music.balance * 100);
    ui.balance.addEventListener("input", () => game.music.setBalance(ui.balance.value / 100));
    ui.seek.addEventListener("input", () => { seeking = true; });
    ui.seek.addEventListener("change", () => {
      game.music.seek((ui.seek.value / 1000) * game.music.duration);
      seeking = false;
    });
    if (!game.music.hasTracks) {
      for (const b of [ui.play, ui.prev, ui.next, ui.stop, ui.shuffle, ui.seek]) b.disabled = true;
    }

    // The round button: across to the other radio, focus staying on the
    // same button in the new skin.
    panel.querySelector(".rs-swap")?.addEventListener("click", (e) => {
      const to = e.currentTarget.dataset.skin;
      try { localStorage.setItem(SKIN_KEY, to); } catch { /* private mode */ }
      mount(to);
      panel.querySelector(".rs-swap")?.focus();
    });

    history.length = 0;
    paintStation();
    paintDurations();
    repaint();
  }

  /* Grinspace: the last N spectra stacked into a tilted sheet of dots, red
     at the front fading to blue at the back, like the original. */
  function drawWaterfall(c, W, H) {
    for (let r = history.length - 1; r >= 0; r--) {
      const d = r / DEPTH;
      const s = 1 - d * 0.55;
      const x0 = W * 0.16 + d * W * 0.32;
      const y0 = H * 0.86 - d * H * 0.52;
      const span = W * 0.62 * s;
      c.fillStyle = `hsl(${d * 240} 95% ${58 - d * 12}%)`;
      const h = history[r];
      for (let b = 0; b < BINS; b++) {
        const x = x0 + (b / (BINS - 1)) * span - d * 30;
        const y = y0 - h[b] * H * 0.42 * s + (b / BINS) * H * 0.12;
        c.fillRect(x, y, 2.4 * s + 0.6, 2.4 * s + 0.6);
      }
    }
  }

  /* Pink / Black tie: a digital LED spectrum, segmented bars rising from
     the bottom of the screen under the song readout, in the skin's two
     colours. */
  function drawLed(c, W, H, row, [lo, hi]) {
    const n = 28, gap = 3;
    const bw = (W - 24 - gap * (n - 1)) / n;
    const base = H * 0.95, seg = 5;
    const grad = c.createLinearGradient(0, base, 0, base - H * 0.6);
    grad.addColorStop(0, lo); grad.addColorStop(1, hi);
    for (let i = 0; i < n; i++) {
      const v = row[Math.floor((i / n) * BINS)];
      const segs = Math.max(1, Math.round((v * H * 0.6) / seg));
      const x = 12 + i * (bw + gap);
      c.fillStyle = grad;
      for (let k = 0; k < segs; k++) c.fillRect(x, base - (k + 1) * seg + 1, bw, seg - 1.5);
    }
  }

  function draw() {
    raf = requestAnimationFrame(draw);
    if (!ui) return;
    const m = game.music;
    const a = m.playing ? m.analyser : null;
    const row = new Float32Array(BINS);
    if (a) {
      a.getByteFrequencyData(freq);
      // Log-ish spread so the bass doesn't eat the whole display.
      for (let b = 0; b < BINS; b++) {
        const lo = Math.floor(Math.pow(b / BINS, 1.6) * 100);
        const hi = Math.max(lo + 1, Math.floor(Math.pow((b + 1) / BINS, 1.6) * 100));
        let v = 0;
        for (let k = lo; k < hi; k++) v = Math.max(v, freq[k]);
        row[b] = v / 255;
      }
    } else {
      idleT += 0.02;
      for (let b = 0; b < BINS; b++) row[b] = 0.05 + 0.04 * Math.sin(idleT + b * 0.4);
    }
    history.unshift(row);
    if (history.length > DEPTH) history.pop();

    // Speakers kick on bass hits: only the jump above the running average
    // counts, or bass-heavy tracks just leave them swollen.
    const bass = a ? (row[0] + row[1] + row[2]) / 3 : 0;
    bassAvg += (bass - bassAvg) * 0.08;
    panel.style.setProperty("--kick", Math.min(1, Math.max(0, (bass - bassAvg) * 7)).toFixed(3));

    const c = ui.vctx, W = ui.viz.width, H = ui.viz.height;
    c.clearRect(0, 0, W, H);
    if (ui.fm) drawLed(c, W, H, row, ui.colors);
    else { c.fillStyle = "#000"; c.fillRect(0, 0, W, H); drawWaterfall(c, W, H); }

    const dur = m.duration;
    if (!seeking) ui.seek.value = dur ? Math.round((m.time / dur) * 1000) : 0;
    ui.time.textContent = dur ? `${fmt(m.time)} / ${fmt(dur)}` : fmt(m.time);

    // The map and mode change under an open radio (Deploy, a vote, a host
    // switch); a once-a-second check is plenty.
    const now = performance.now();
    if (now - stationT > 1000) { stationT = now; paintStation(); }
  }

  function setOpen(open) {
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    cancelAnimationFrame(raf);
    raf = 0;
    if (open) {
      paintStation();
      loadDurations(paintDurations);
      draw();                      // only spends frames while it's on screen
    }
  }

  toggle.addEventListener("click", () => setOpen(panel.hidden));
  panel.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.stopPropagation(); setOpen(false); toggle.focus(); }
  });
  game.music.onchange = repaint;

  mount(skin);

  // Music is opt-in: nothing plays until the player hits Play. Whatever state
  // they leave it in on the menu (playing or paused) carries into the match.
}
