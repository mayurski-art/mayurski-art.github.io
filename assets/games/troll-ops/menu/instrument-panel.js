// Troll Forces — the saloon band's panel (BAND.md): the piano's keys, the
// trumpet's valves, the guitar's chords, and the sheet music for each
// (songs.js, drawn by notation.js). One panel, three instruments:
//
//   piano    the keys C3-G5 off the keyboard (Z S X D C... and Q 2 W 3 E...)
//   trumpet  the same keys, one note at a time, held while the key is down;
//            each labelled with its valves
//   guitar   Strum: chord pads on 1-8 (Shift strums up); Pick: the keys,
//            written an octave up as guitar music is
//
// Sheets come in three levels per instrument; the cursor lights the next
// note and moves on when you play it. With the band playing the open song
// (modes/social-band.js), the playhead runs with the room and each note
// is judged on time, early/late or missed ("Bravo: 38 / 42 on time"). "Hear it" plays the part here only
// (never to the room). The panel makes no sound itself: `h.play(ev)` does
// (modes/social-rp.js for the piano, modes/social-band.js for the others).
// Esc closes it; keys are caught in the capture phase while it's open.

import { SONGS, LEVELS, songsFor, playNotes, partEvents, chordTones, guitarVoicing, midiName, LOW, HIGH } from "../songs.js?v=sg1";
import { scoreSvg, beatX, valves } from "../notation.js?v=nt1";

/* Key code -> midi. Bottom row C3-B3, top row C4-B4, then I 9 O 0 P [ = ]
   up to G5. */
const CODES = {
  KeyZ: 48, KeyS: 49, KeyX: 50, KeyD: 51, KeyC: 52, KeyV: 53, KeyG: 54, KeyB: 55, KeyH: 56, KeyN: 57, KeyJ: 58, KeyM: 59,
  KeyQ: 60, Digit2: 61, KeyW: 62, Digit3: 63, KeyE: 64, KeyR: 65, Digit5: 66, KeyT: 67, Digit6: 68, KeyY: 69, Digit7: 70, KeyU: 71,
  KeyI: 72, Digit9: 73, KeyO: 74, Digit0: 75, KeyP: 76, BracketLeft: 77, Equal: 78, BracketRight: 79,
};
const LABEL = {};
for (const [code, m] of Object.entries(CODES)) LABEL[m] = code.replace(/^Key|^Digit/, "").replace("BracketLeft", "[").replace("BracketRight", "]").replace("Equal", "=");
const BLACK = new Set([1, 3, 6, 8, 10]);
const PAD_CODES = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8"];
const DEFAULT_PADS = ["C", "G", "Am", "F", "Dm", "E7", "D7", "G7"];
const TITLES = { piano: "Saloon piano", guitar: "Guitar", trumpet: "Trumpet" };

let cssDone = false;

export class InstrumentPanel {
  /* kind: "piano" | "guitar" | "trumpet".
     h: { mount, isTouch, releaseInputs(), lock(), unlock(), banner(text, ms),
          play(ev): ev = { type: "note", midi, dur?, preview? } | { type: "off", midi }
                    | { type: "strum", midis, up, chord, dur?, preview? },
          onStand(), standLabel, onAuto?(), autoOn?(),
          band?: { running() -> { song, beat, beats, leader } | null, start(i), stop(),
                   isLeader(), auto(), setAuto(on) } } */
  constructor(kind, h) {
    this.kind = kind;
    this.h = h;
    this.song = null;       // the open sheet
    this.notes = [];        // what we play of it (songs.js playNotes)
    this.cursor = 0;
    this.level = "Basic";
    this.mode = "strum";    // the guitar: "strum" | "pick"
    this.demo = null;       // "Hear it": { timers, raf }
    this.hits = 0;          // notes played (the test reads it)
    this.held = new Map();  // trumpet: key code -> midi held
    this.songIdx = -1;
    this.along = null;      // playing along with the band: { next, on, close, miss, song }
    this.lastAlong = null;  // how the last one went (the test reads it)
    this._raf = 0;
    this._build();
  }

  get isOpen() { return !this.ui.panel.hidden; }

  open() {
    if (this.isOpen) return;
    this.h.releaseInputs();
    this.ui.panel.hidden = false;
    this._wasLocked = !this.h.isTouch;
    if (!this.h.isTouch) this.h.unlock();
    this._render();
    this._tick();
  }

  close(silent = false) {
    if (!this.isOpen) return;
    this.stopDemo();
    this._releaseAll();
    this.ui.panel.hidden = true;
    cancelAnimationFrame(this._raf);
    this.along = null;
    this.h.releaseInputs();
    if (!silent && this._wasLocked) this.h.lock();
  }

  dispose() {
    this.close(true);
    this.ui.panel.remove();
    window.removeEventListener("keydown", this._keys, true);
    window.removeEventListener("keyup", this._keysUp, true);
  }

  /* ------------------------------------------------------------ playing */

  /* A note key (piano, trumpet, the guitar picking): written pitch. */
  press(midi) {
    if (midi < LOW || midi > HIGH) return;
    const sound = this.kind === "guitar" ? midi - 12 : midi;
    this.h.play({ type: "note", midi: sound });
    this.hits++;
    this._flash(this.ui.keys.get(midi));
    this._judge((want) => !want.strum && (want.midis || [want.midi]).includes(midi));
  }
  /* The trumpet: the key's up, the note stops (unless another's held). */
  release(midi) {
    if (this.kind !== "trumpet") return;
    this.h.play({ type: "off", midi });
  }
  /* A chord pad (the guitar). */
  strum(i, up = false) {
    const name = this.pads[i];
    const chord = name && chordTones(name);
    if (!chord) return;
    this.h.play({ type: "strum", midis: guitarVoicing(chord), up, chord: name });
    this.hits++;
    this._flash(this.ui.pads[i]);
    this._judge((want) => !!want.strum && want.chord?.name === name);
  }

  /* With a sheet open: the right note moves the cursor on, a wrong one shakes. */
  _judge(ok) {
    if (this.along) { this._judgeAlong(ok); return; }
    if (!this.song || this.cursor >= this.notes.length) return;
    if (ok(this.notes[this.cursor])) {
      this.cursor++;
      if (this.cursor >= this.notes.length) this.h.banner?.(`${this.song.name}: bravo!`, 2200);
    } else {
      const g = this._noteEl(this.cursor);
      g?.classList.remove("is-wrong"); void g?.getBoundingClientRect(); g?.classList.add("is-wrong");
    }
    this._cursor();
  }

  /* With the band: the note due now (within 0.25 s) is the one to hit. */
  _judgeAlong(ok) {
    const A = this.along, R = this.h.band.running();
    if (!R || A.next >= this.notes.length) return;
    const want = this.notes[A.next];
    const dt = (R.beat - want.at) * (60 / this.song.bpm);
    if (ok(want) && Math.abs(dt) <= 0.25) {
      if (Math.abs(dt) <= 0.12) A.on++; else A.close++;
      A.next++;
      this.cursor = A.next;
      this._cursor();
      return;
    }
    const g = this._noteEl(A.next);
    g?.classList.remove("is-wrong"); void g?.getBoundingClientRect(); g?.classList.add("is-wrong");
  }

  /* While open: the band's playhead, the play-along's misses and its end. */
  _tick() {
    cancelAnimationFrame(this._raf);
    if (!this.isOpen) return;
    const R = this.h.band?.running();
    const mine = R && this.song && R.song === this.songIdx;
    if (mine) {
      if (!this.along || this.along.song !== R.song) {
        this.along = { song: R.song, next: 0, on: 0, close: 0, miss: 0 };
        this.cursor = 0;
        this._cursor();
        this._renderActs();
      }
      const A = this.along, spb = 60 / this.song.bpm;
      if (!this.demo) this.setPlayhead(Math.max(0, R.beat));
      let moved = false;
      while (A.next < this.notes.length && (R.beat - this.notes[A.next].at) * spb > 0.25) { A.miss++; A.next++; moved = true; }
      if (moved) { this.cursor = A.next; this._cursor(); }
      if (R.beat > R.beats) this._endAlong();
    } else if (this.along) this._endAlong();
    this._raf = requestAnimationFrame(() => this._tick());
  }
  _endAlong() {
    const A = this.along;
    if (!A) return;
    this.along = null;
    this.lastAlong = { ...A, of: this.notes.length };
    const hit = A.on + A.close;
    if (this.notes.length) this.h.banner?.(hit >= this.notes.length * 0.8 ? `Bravo: ${A.on} / ${this.notes.length} on time` : `${hit} / ${this.notes.length} notes: again?`, 2600);
    if (!this.demo) this.setPlayhead(null);
    this._renderActs();
  }

  _flash(el) {
    if (!el) return;
    el.classList.add("is-down");
    clearTimeout(el._up);
    el._up = setTimeout(() => el.classList.remove("is-down"), 160);
  }
  _releaseAll() {
    for (const m of this.held.values()) this.release(m);
    this.held.clear();
  }

  pick(i) {
    this.stopDemo();
    this.songIdx = SONGS[i] ? i : -1;
    this.song = SONGS[i] || null;
    this.notes = this.song ? playNotes(this.song, this.kind) : [];
    this.cursor = 0;
    if (this.kind === "guitar") this.mode = this.notes.some((n) => n.strum) ? "strum" : "pick";
    this._render();
  }

  /* Play the open part here, at its tempo, the playhead running along
     (local only: `preview`). The piano plays both hands. */
  hear() {
    if (!this.song) return;
    this.stopDemo();
    const spb = 60 / (this.song.bpm || 100);
    const timers = [];
    let end = 0;
    for (const e of partEvents(this.song, this.kind)) {
      const t = e.at * spb * 1000, dur = e.beats * spb;
      end = Math.max(end, t + dur * 1000);
      timers.push(setTimeout(() => {
        if (e.strum) this.h.play({ type: "strum", midis: e.midis, up: e.strum === "U", dur, preview: true, vel: e.vel });
        else for (const m of e.midis) this.h.play({ type: "note", midi: m, dur, preview: true, vel: e.vel });
      }, t));
    }
    const t0 = performance.now();
    const tick = () => {
      if (!this.demo) return;
      this.setPlayhead((performance.now() - t0) / 1000 / spb);
      this.demo.raf = requestAnimationFrame(tick);
    };
    timers.push(setTimeout(() => { this.stopDemo(); this._renderActs(); }, end + 300));
    this.demo = { timers, raf: requestAnimationFrame(tick) };
    this._renderActs();
  }

  stopDemo() {
    if (!this.demo) return;
    for (const id of this.demo.timers) clearTimeout(id);
    cancelAnimationFrame(this.demo.raf);
    this.demo = null;
    this.setPlayhead(null);
  }

  /* The playhead at song beat `beat` (null hides it). */
  setPlayhead(beat) {
    const line = this.ui.score.querySelector(".to-playhead");
    if (!line || !this.layout) return;
    const at = beat == null ? null : beatX(this.layout, beat);
    if (!at) { line.setAttribute("opacity", "0"); return; }
    const sys = this.layout.systems[at.sys];
    line.setAttribute("x1", at.x); line.setAttribute("x2", at.x);
    line.setAttribute("y1", sys.top + 6); line.setAttribute("y2", sys.top + sys.height - 6);
    line.setAttribute("opacity", "0.85");
    this._scrollTo(sys.top, sys.height);
  }

  state() {
    return { open: this.isOpen, kind: this.kind, sheet: this.song?.name || null, cursor: this.cursor, length: this.notes.length,
      hits: this.hits, mode: this.mode, pads: [...this.pads], hearing: !!this.demo,
      along: this.along && { ...this.along }, lastAlong: this.lastAlong };
  }

  /* ------------------------------------------------------------ the DOM */

  _build() {
    injectCss();
    const p = document.createElement("div");
    p.className = `to-piano is-${this.kind}`;
    p.hidden = true;
    p.setAttribute("role", "dialog");
    p.setAttribute("aria-label", TITLES[this.kind]);
    p.innerHTML = `
      <div class="to-piano-head">
        <b class="to-piano-title">${TITLES[this.kind]}</b>
        <span class="to-piano-now"></span>
        <span class="to-piano-acts">
          <button type="button" data-a="sheets">Sheets</button>
          ${this.h.onAuto ? `<button type="button" data-a="auto"></button>` : ""}
          ${this.kind === "guitar" ? `<button type="button" data-a="mode"></button>` : ""}
          <button type="button" data-a="stand">${this.h.standLabel || "Stand up"}</button>
          <button type="button" data-a="close" class="to-piano-x" aria-label="Close (Esc)">×</button>
        </span>
      </div>
      <div class="to-piano-sheet"></div>
      <div class="to-guitar-pads" aria-label="Chords"></div>
      <div class="to-piano-keys" aria-label="${this.kind === "trumpet" ? "Trumpet notes" : this.kind === "guitar" ? "Guitar notes" : "Piano keys"}"></div>`;
    (this.h.mount || document.body).appendChild(p);
    this.ui = { panel: p, now: p.querySelector(".to-piano-now"), sheetBox: p.querySelector(".to-piano-sheet"),
      keyBox: p.querySelector(".to-piano-keys"), padBox: p.querySelector(".to-guitar-pads"), auto: p.querySelector('[data-a="auto"]'),
      modeBtn: p.querySelector('[data-a="mode"]'), keys: new Map(), pads: [], score: document.createElement("div") };
    this.pads = [...DEFAULT_PADS];

    // the keys: white ones in a row, the black ones over the gaps
    const whites = [];
    for (let m = LOW; m <= HIGH; m++) if (!BLACK.has(m % 12)) whites.push(m);
    const W = 100 / whites.length;
    let wi = 0;
    for (let m = LOW; m <= HIGH; m++) {
      const black = BLACK.has(m % 12);
      const k = document.createElement("button");
      k.type = "button";
      k.className = black ? "to-piano-key is-black" : "to-piano-key";
      k.style.left = black ? `${wi * W - W * 0.3}%` : `${wi * W}%`;
      k.style.width = black ? `${W * 0.6}%` : `${W}%`;
      const name = midiName(this.kind === "guitar" ? m - 12 : m);
      k.setAttribute("aria-label", this.kind === "trumpet" ? `${name}, valves ${valves(m)}` : name);
      const sub = this.kind === "trumpet" ? valves(m) : black ? "" : name;
      k.innerHTML = `${this.h.isTouch ? "" : `<b>${LABEL[m] || ""}</b>`}${sub ? `<i>${sub}</i>` : ""}`;
      k.addEventListener("pointerdown", (e) => { e.preventDefault(); this.press(m); if (this.kind === "trumpet") { this.held.set(`p${e.pointerId}`, m); } });
      if (this.kind === "trumpet") {
        const up = (e) => { const h = this.held.get(`p${e.pointerId}`); if (h != null) { this.held.delete(`p${e.pointerId}`); this.release(h); } };
        k.addEventListener("pointerup", up);
        k.addEventListener("pointerleave", up);
        k.addEventListener("pointercancel", up);
      }
      this.ui.keyBox.appendChild(k);
      this.ui.keys.set(m, k);
      if (!black) wi++;
    }

    // clicks on the panel are the panel's, not the game's (fire, re-lock)
    for (const ev of ["mousedown", "pointerdown", "click", "wheel", "touchstart"]) p.addEventListener(ev, (e) => e.stopPropagation());
    p.addEventListener("click", (e) => {
      const a = e.target.closest("button[data-a]")?.dataset.a;
      if (a === "close") this.close();
      else if (a === "stand") { this.close(); this.h.onStand(); }
      else if (a === "auto") { this.h.onAuto(); this._renderActs(); }
      else if (a === "mode") { this.mode = this.mode === "strum" ? "pick" : "strum"; this._renderInput(); }
      else if (a === "sheets") { this.stopDemo(); this.song = null; this.songIdx = -1; this.notes = []; this._render(); }
      else if (a === "hear") this.demo ? (this.stopDemo(), this._renderActs()) : this.hear();
      else if (a === "again") { this.cursor = 0; this._cursor(); }
      else if (a === "band") {
        const R = this.h.band?.running();
        if (R && R.song === this.songIdx) { if (this.h.band.isLeader()) this.h.band.stop(); }
        else if (this.songIdx >= 0) { this.stopDemo(); this.h.band.start(this.songIdx); }
        this._renderActs();
      } else if (a === "bandauto") { this.h.band.setAuto(!this.h.band.auto()); this._renderActs(); }
      const lv = e.target.closest("button[data-level]")?.dataset.level;
      if (lv) { this.level = lv; this._render(); }
      const pc = e.target.closest("button[data-sheet]")?.dataset.sheet;
      if (pc != null) this.pick(+pc);
    });
    this.ui.padBox.addEventListener("pointerdown", (e) => {
      const b = e.target.closest("button[data-pad]");
      if (!b) return;
      e.preventDefault();
      this.strum(+b.dataset.pad, e.shiftKey || e.button === 2);
    });
    this.ui.padBox.addEventListener("contextmenu", (e) => e.preventDefault());

    // keys while it's open belong to it: notes, chords, Esc closes
    this._keys = (e) => {
      if (!this.isOpen) return;
      e.stopImmediatePropagation();
      if (e.code === "Escape") { e.preventDefault(); this.close(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (this.kind === "guitar" && this.mode === "strum") {
        const pad = PAD_CODES.indexOf(e.code);
        if (pad >= 0) { e.preventDefault(); if (!e.repeat) this.strum(pad, e.shiftKey); return; }
      }
      const m = CODES[e.code];
      if (m == null) return;
      e.preventDefault();
      if (e.repeat) return;
      this.press(m);
      if (this.kind === "trumpet") this.held.set(e.code, m);
    };
    this._keysUp = (e) => {
      if (!this.isOpen || this.kind !== "trumpet") return;
      const m = this.held.get(e.code);
      if (m == null) return;
      e.stopImmediatePropagation();
      this.held.delete(e.code);
      this.release(m);
    };
    window.addEventListener("keydown", this._keys, true);
    window.addEventListener("keyup", this._keysUp, true);
  }

  _render() {
    const ui = this.ui;
    ui.now.textContent = this.song ? `${this.song.levels[this.kind]} · ${this.song.name}${this.song.by ? ` · ${this.song.by}` : ""}` : "Pick a sheet, or just play";
    this.layout = null;
    if (!this.song) {
      // the sheet list: three levels, by this instrument's part
      ui.sheetBox.innerHTML = `<div class="to-piano-levels">${LEVELS.map((l) => `<button type="button" data-level="${l}" class="${l === this.level ? "is-on" : ""}">${l}</button>`).join("")}</div>
        <div class="to-piano-list">${songsFor(this.kind, this.level).map(({ s, i }) => `<button type="button" data-sheet="${i}">${s.name}<small>${s.by || ""}${s.lead === this.kind ? " · the lead" : ""}</small></button>`).join("")}</div>`;
    } else {
      const { svg, layout } = scoreSvg(this.song, this.kind);
      this.layout = layout;
      ui.score.className = "to-score";
      ui.score.innerHTML = svg;
      ui.sheetBox.innerHTML = `<div class="to-piano-sheet-acts"></div>`;
      ui.sheetBox.prepend(ui.score);
      ui.score.scrollTop = 0;
    }
    this._renderActs();
    this._renderInput();
    this._cursor();
  }

  _renderActs() {
    if (this.ui.auto) this.ui.auto.textContent = this.h.autoOn?.() ? "Stop the tune" : "Let it play";
    const acts = this.ui.sheetBox.querySelector(".to-piano-sheet-acts");
    if (!acts) return;
    let bandBtn = "";
    if (this.h.band) {
      const R = this.h.band.running(), on = R && R.song === this.songIdx;
      bandBtn = on
        ? (this.h.band.isLeader() ? `<button type="button" data-a="band" class="is-on">Stop the band</button>` : `<button type="button" data-a="band" class="is-on" disabled>The band's playing</button>`)
          + `<button type="button" data-a="bandauto" class="${this.h.band.auto() ? "is-on" : ""}">Auto: ${this.h.band.auto() ? "on" : "off"}</button>`
        : `<button type="button" data-a="band" title="Everyone hears it together; the townsfolk play the other parts">Band: play it together</button>`;
    }
    acts.innerHTML = `<button type="button" data-a="hear">${this.demo ? "Stop" : "Hear it"}</button><button type="button" data-a="again">From the top</button>${bandBtn}`;
  }

  /* The guitar's pads (the song's chords, in order, or a starter set) and
     whether the keys or the pads lead. */
  _renderInput() {
    const ui = this.ui;
    if (this.kind !== "guitar") { ui.padBox.hidden = true; return; }
    if (this.song) {
      const seen = [];
      for (const n of this.notes) if (n.chord && !seen.includes(n.chord.name)) seen.push(n.chord.name);
      for (const n of DEFAULT_PADS) if (seen.length < 8 && !seen.includes(n)) seen.push(n);
      this.pads = seen.slice(0, 8);
    } else this.pads = [...DEFAULT_PADS];
    ui.modeBtn.textContent = this.mode === "strum" ? "Pick notes" : "Strum chords";
    ui.padBox.hidden = this.mode !== "strum";
    ui.keyBox.hidden = this.mode === "strum";
    ui.padBox.innerHTML = this.pads.map((c, i) => `<button type="button" data-pad="${i}" aria-label="Strum ${c}">${this.h.isTouch ? "" : `<b>${i + 1}</b>`}<span>${c}</span></button>`).join("")
      + `<small>${this.h.isTouch ? "Tap a chord to strum it" : "1-8 strum down · Shift strums up"}</small>`;
    ui.pads = [...ui.padBox.querySelectorAll("button[data-pad]")];
    this._cursor();
  }

  _noteEl(i) { return this.ui.score.querySelector(`.nt[data-i="${i}"]`); }

  /* Done notes dim, the next one lights (on the staff, its key or pad). */
  _cursor() {
    const { keys, score } = this.ui;
    for (const g of score.querySelectorAll(".nt")) {
      const i = +g.dataset.i;
      g.classList.toggle("is-done", i < this.cursor);
      g.classList.toggle("is-next", i === this.cursor);
    }
    for (const k of keys.values()) k.classList.remove("is-next");
    for (const p of this.ui.pads) p.classList.remove("is-next");
    const next = this.song && this.notes[this.cursor];
    if (next?.strum) this.ui.pads[this.pads.indexOf(next.chord?.name)]?.classList.add("is-next");
    else if (next) keys.get(next.midi)?.classList.add("is-next");
    const at = next && this.layout?.notes[this.cursor];
    if (at) { const sys = this.layout.systems[at.sys]; this._scrollTo(sys.top, sys.height); }
  }

  /* Keep a line of music in view inside the score box (not the page). */
  _scrollTo(top, height) {
    const box = this.ui.score, svg = box.querySelector("svg");
    if (!svg || !this.layout) return;
    const k = svg.getBoundingClientRect().width / this.layout.width || 1;
    const y0 = top * k, y1 = (top + height) * k;
    if (y0 < box.scrollTop || y1 > box.scrollTop + box.clientHeight) box.scrollTop = Math.max(0, y0 - 4);
  }
}

function injectCss() {
  if (cssDone) return;
  cssDone = true;
  const st = document.createElement("style");
  st.textContent = `
.to-piano { --pn-wood: rgba(34,20,13,.92); --pn-cream: #f4e8cf; --pn-dim: rgba(244,232,207,.62); --pn-brass: #e0ad4f;
  position: absolute; left: 50%; bottom: 16px; transform: translateX(-50%); z-index: 14;
  width: min(780px, calc(100vw - 32px)); box-sizing: border-box; padding: 10px 12px 12px;
  border-radius: 16px; background: linear-gradient(180deg, rgba(58,34,20,.94), var(--pn-wood));
  border: 0.5px solid rgba(224,173,79,.5); box-shadow: 0 10px 34px rgba(0,0,0,.5);
  color: var(--pn-cream); font-family: "DM Sans", sans-serif; text-shadow: none; pointer-events: auto;
  animation: to-pn-in .3s cubic-bezier(.2,.9,.3,1.15); }
.to-piano[hidden], .to-piano [hidden] { display: none !important; }
@keyframes to-pn-in { from { opacity: 0; transform: translate(-50%, 12px); } }
.to-piano button { font: inherit; color: inherit; cursor: pointer; }
.to-piano button:focus-visible { outline: 2px solid var(--pn-brass); outline-offset: 2px; }
.to-piano-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }
.to-piano-title { font: 700 13px/1 "DM Mono", monospace; letter-spacing: .08em; text-transform: uppercase; color: var(--pn-brass); }
.to-piano-now { flex: 1; min-width: 120px; font-size: 13px; color: var(--pn-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.to-piano-acts { display: flex; gap: 6px; flex-wrap: wrap; }
.to-piano-acts button, .to-piano-sheet-acts button, .to-piano-levels button {
  padding: 6px 11px; border-radius: 999px; font-size: 12.5px; font-weight: 600;
  background: rgba(244,232,207,.08); border: 0.5px solid rgba(244,232,207,.22); }
.to-piano-acts button:hover, .to-piano-sheet-acts button:hover, .to-piano-levels button:hover { background: rgba(244,232,207,.16); }
.to-piano-levels button.is-on, .to-piano-sheet-acts button.is-on { background: var(--pn-brass); color: #2a170c; border-color: transparent; }
.to-piano-sheet-acts button[disabled] { opacity: .8; cursor: default; }
.to-piano .to-piano-x { width: 30px; padding: 6px 0; font-size: 16px; line-height: 1; }
.to-piano-sheet { margin-bottom: 10px; }
.to-piano-levels { display: flex; gap: 6px; margin-bottom: 8px; }
.to-piano-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 6px; max-height: 190px; overflow-y: auto; }
.to-piano-list button { text-align: left; padding: 9px 11px; border-radius: 10px; font-size: 13.5px; font-weight: 600;
  background: rgba(244,232,207,.06); border: 0.5px solid rgba(244,232,207,.16); }
.to-piano-list button:hover { background: rgba(224,173,79,.18); border-color: rgba(224,173,79,.5); }
.to-piano-list small { display: block; margin-top: 2px; font: 500 11px/1.2 "DM Mono", monospace; color: var(--pn-dim); }
.to-score { max-height: 196px; overflow-y: auto; padding: 4px 6px; border-radius: 10px; background: #f4e8cf; }
.to-score svg { display: block; }
.to-score .nt .hd { transition: fill .12s; }
.to-score .nt.is-done { opacity: .35; }
.to-score .nt.is-next .hd { fill: #e0ad4f; stroke: #7a1f1f; stroke-width: 1.6; }
.to-score .nt.is-wrong { animation: to-pn-wrong .28s; transform-box: fill-box; }
@keyframes to-pn-wrong { 25% { transform: translateX(-3px); } 75% { transform: translateX(3px); } }
.to-piano-sheet-acts { display: flex; gap: 6px; margin-top: 7px; }
.to-piano-keys { position: relative; height: 112px; overflow: hidden; border-radius: 0 0 8px 8px; border-top: 4px solid #7a1f1f; }
.to-piano .to-piano-key { position: absolute; top: 0; height: 100%; box-sizing: border-box; padding: 0 0 6px; margin: 0;
  display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 2px;
  background: linear-gradient(180deg, #fffaf0, #efe3c8); border: 0.5px solid #8a7a60; border-radius: 0 0 6px 6px;
  color: #3a2616; touch-action: none; user-select: none; -webkit-user-select: none; }
.to-piano-key b { font: 700 12px/1 "DM Mono", monospace; }
.to-piano-key i { font: 500 8.5px/1 "DM Mono", monospace; font-style: normal; opacity: .6; }
.to-piano .to-piano-key.is-black { z-index: 2; height: 62%; background: linear-gradient(180deg, #2a2522, #0c0a09); border-color: #000; color: #f4e8cf; }
.to-piano-key.is-next { box-shadow: inset 0 -26px 22px -12px rgba(224,173,79,.9); }
.to-piano .to-piano-key.is-down { background: linear-gradient(180deg, #ffe2a0, #e0ad4f); transform: translateY(1px); }
.to-piano .to-piano-key.is-black.is-down { background: linear-gradient(180deg, #6a4a1a, #3a2410); }
.to-piano.is-trumpet .to-piano-keys { border-top-color: #b8862e; }
.to-piano.is-trumpet .to-piano-key i { font-weight: 700; opacity: .8; color: #7a1f1f; }
.to-piano.is-trumpet .to-piano-key.is-black i { color: #e0ad4f; }
.to-guitar-pads { display: grid; grid-template-columns: repeat(8, 1fr); gap: 6px; align-items: stretch; }
.to-guitar-pads small { grid-column: 1 / -1; font: 500 11px/1.2 "DM Mono", monospace; color: var(--pn-dim); text-align: center; }
.to-guitar-pads button { height: 84px; border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
  background: linear-gradient(180deg, #8a5a2b, #5a3417); border: 0.5px solid rgba(224,173,79,.45); touch-action: none; user-select: none; -webkit-user-select: none; }
.to-guitar-pads button b { font: 700 11px/1 "DM Mono", monospace; opacity: .7; }
.to-guitar-pads button span { font: 800 19px/1 "DM Sans", sans-serif; }
.to-guitar-pads button.is-next { box-shadow: 0 0 0 2px #e0ad4f inset, 0 0 14px rgba(224,173,79,.6); }
.to-guitar-pads button.is-down { background: linear-gradient(180deg, #e0ad4f, #b8862e); color: #2a170c; transform: translateY(1px); }
@media (max-width: 600px) {
  .to-piano { bottom: 8px; padding: 8px; }
  .to-piano-keys { height: 92px; }
  .to-piano-key i { display: none; }
  .to-piano.is-trumpet .to-piano-key i { display: block; font-size: 7px; }
  .to-score { max-height: 132px; }
  .to-guitar-pads { grid-template-columns: repeat(4, 1fr); }
  .to-guitar-pads button { height: 52px; }
}`;
  document.head.appendChild(st);
}
