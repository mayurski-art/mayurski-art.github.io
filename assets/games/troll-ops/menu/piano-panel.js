// Troll Forces — the saloon piano's keys and sheet music (Socialize, Troll
// City). Sat at the piano, this opens: a key strip C3 to G5 played off the
// keyboard (two rows, like a tracker: Z S X D C... and Q 2 W 3 E...) or by
// tapping, and sheets from easy to hard (piano-sheets.js) with a cursor that
// moves on when you hit the right key. "Hear it" plays the piece for you;
// "Let it play" is the saloon's own tunes as before.
//
// The panel only plays notes through `onNote`; social-rp.js sounds them and
// sends them to the room. Esc closes it (you stay sat down), "Stand up"
// gets up. Same pattern as the DJ booth (dj-lulz.js): its own DOM and CSS,
// keys caught in the capture phase while it's open.

import { SHEETS, sheetBars, midiName, LOW, HIGH } from "../piano-sheets.js?v=ps1";

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
const LEVELS = ["Easy", "Medium", "Hard"];

let cssDone = false;

export class PianoPanel {
  /* h: { mount, isTouch, releaseInputs(), lock(), unlock(), onNote(midi),
     onAuto(), autoOn(), onStand(), banner(text, ms) } */
  constructor(h) {
    this.h = h;
    this.sheet = null;      // the open piece
    this.notes = [];        // its notes, flat
    this.cursor = 0;
    this.level = "Easy";
    this.demo = [];         // "Hear it" timers
    this.hits = 0;          // notes played (the test reads it)
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
  }

  close(silent = false) {
    if (!this.isOpen) return;
    this.stopDemo();
    this.ui.panel.hidden = true;
    this.h.releaseInputs();
    if (!silent && this._wasLocked) this.h.lock();
  }

  dispose() {
    this.close(true);
    this.ui.panel.remove();
    window.removeEventListener("keydown", this._keys, true);
  }

  /* A key, from the keyboard, a tap, or "Hear it" (`demo`: doesn't move the
     cursor). */
  press(midi, demo = false) {
    if (midi < LOW || midi > HIGH) return;
    this.h.onNote(midi);
    this.hits++;
    const k = this.ui.keys.get(midi);
    if (k) { k.classList.add("is-down"); clearTimeout(k._up); k._up = setTimeout(() => k.classList.remove("is-down"), 160); }
    if (demo || !this.sheet || this.cursor >= this.notes.length) return;
    const want = this.notes[this.cursor];
    if (want.midi === midi) {
      this.cursor++;
      if (this.cursor >= this.notes.length) this.h.banner?.(`${this.sheet.name}: bravo!`, 2200);
    } else {
      const chip = this.ui.chips[this.cursor];
      chip?.classList.remove("is-wrong"); void chip?.offsetWidth; chip?.classList.add("is-wrong");
    }
    this._cursor();
  }

  pick(i) {
    this.stopDemo();
    this.sheet = SHEETS[i] || null;
    this.bars = this.sheet ? sheetBars(this.sheet) : [];
    this.notes = this.bars.flat();
    this.cursor = 0;
    this._render();
  }

  /* Play the open piece through the keys, at its tempo. */
  hear() {
    if (!this.sheet) return;
    this.stopDemo();
    const spb = 60 / (this.sheet.bpm || 100);
    let t = 0;
    for (const n of this.notes) {
      this.demo.push(setTimeout(() => this.press(n.midi, true), t * 1000));
      t += n.beats * spb;
    }
    this.demo.push(setTimeout(() => { this.demo = []; this._render(); }, t * 1000 + 200));
    this._render();
  }

  stopDemo() {
    for (const id of this.demo) clearTimeout(id);
    this.demo = [];
  }

  state() {
    return { open: this.isOpen, sheet: this.sheet?.name || null, cursor: this.cursor, length: this.notes.length, hits: this.hits };
  }

  /* ------------------------------------------------------------ the DOM */

  _build() {
    injectCss();
    const p = document.createElement("div");
    p.className = "to-piano";
    p.hidden = true;
    p.setAttribute("role", "dialog");
    p.setAttribute("aria-label", "Saloon piano");
    p.innerHTML = `
      <div class="to-piano-head">
        <b class="to-piano-title">Saloon piano</b>
        <span class="to-piano-now"></span>
        <span class="to-piano-acts">
          <button type="button" data-a="sheets">Sheets</button>
          <button type="button" data-a="auto"></button>
          <button type="button" data-a="stand">Stand up</button>
          <button type="button" data-a="close" class="to-piano-x" aria-label="Close the piano (Esc)">×</button>
        </span>
      </div>
      <div class="to-piano-sheet"></div>
      <div class="to-piano-keys" aria-label="Piano keys"></div>`;
    (this.h.mount || document.body).appendChild(p);
    this.ui = { panel: p, now: p.querySelector(".to-piano-now"), sheetBox: p.querySelector(".to-piano-sheet"),
      keyBox: p.querySelector(".to-piano-keys"), auto: p.querySelector('[data-a="auto"]'), keys: new Map(), chips: [] };

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
      k.setAttribute("aria-label", midiName(m));
      k.innerHTML = `${this.h.isTouch ? "" : `<b>${LABEL[m] || ""}</b>`}${black ? "" : `<i>${midiName(m)}</i>`}`;
      k.addEventListener("pointerdown", (e) => { e.preventDefault(); this.press(m); });
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
      else if (a === "auto") { this.h.onAuto(); this._render(); }
      else if (a === "sheets") { this.stopDemo(); this.sheet = null; this.notes = []; this._render(); }
      else if (a === "hear") this.demo.length ? (this.stopDemo(), this._render()) : this.hear();
      else if (a === "again") { this.cursor = 0; this._render(); }
      const lv = e.target.closest("button[data-level]")?.dataset.level;
      if (lv) { this.level = lv; this._render(); }
      const pc = e.target.closest("button[data-sheet]")?.dataset.sheet;
      if (pc != null) this.pick(+pc);
    });

    // keys while it's open belong to it: notes, Esc closes
    this._keys = (e) => {
      if (!this.isOpen) return;
      e.stopImmediatePropagation();
      if (e.code === "Escape") { e.preventDefault(); this.close(); return; }
      const m = CODES[e.code];
      if (m == null || e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      if (!e.repeat) this.press(m);
    };
    window.addEventListener("keydown", this._keys, true);
  }

  _render() {
    const ui = this.ui;
    ui.auto.textContent = this.h.autoOn() ? "Stop the tune" : "Let it play";
    ui.now.textContent = this.sheet ? `${this.sheet.level} · ${this.sheet.name}` : "Pick a sheet, or just play";
    ui.chips = [];
    if (!this.sheet) {
      // the sheet list: three levels
      ui.sheetBox.innerHTML = `<div class="to-piano-levels">${LEVELS.map((l) => `<button type="button" data-level="${l}" class="${l === this.level ? "is-on" : ""}">${l}</button>`).join("")}</div>
        <div class="to-piano-list">${SHEETS.map((s, i) => (s.level === this.level ? `<button type="button" data-sheet="${i}">${s.name}<small>${sheetBars(s).flat().length} notes</small></button>` : "")).join("")}</div>`;
    } else {
      ui.sheetBox.innerHTML = `<div class="to-piano-bars"></div>
        <div class="to-piano-sheet-acts"><button type="button" data-a="hear">${this.demo.length ? "Stop" : "Hear it"}</button><button type="button" data-a="again">From the top</button></div>`;
      const box = ui.sheetBox.querySelector(".to-piano-bars");
      for (const bar of this.bars) {
        const b = document.createElement("span");
        b.className = "to-piano-bar";
        for (const n of bar) {
          const c = document.createElement("span");
          c.className = "to-piano-chip";
          c.style.flexGrow = String(Math.max(0.6, n.beats));
          c.innerHTML = `<b>${this.h.isTouch ? n.name.replace(/\d/, "") : LABEL[n.midi] || "?"}</b><i>${n.name}</i>`;
          b.appendChild(c);
          ui.chips.push(c);
        }
        box.appendChild(b);
      }
    }
    this._cursor();
  }

  /* Done notes dim, the next one lights, and its key glows. */
  _cursor() {
    const { chips, keys } = this.ui;
    chips.forEach((c, i) => { c.classList.toggle("is-done", i < this.cursor); c.classList.toggle("is-next", i === this.cursor); });
    for (const k of keys.values()) k.classList.remove("is-next");
    const next = this.sheet && this.notes[this.cursor];
    if (next) keys.get(next.midi)?.classList.add("is-next");
    const c = chips[this.cursor];
    const box = this.ui.sheetBox.querySelector(".to-piano-bars");
    if (c && box) {
      // keep the next note in view inside the sheet (not the page)
      const top = c.offsetTop - box.offsetTop;
      if (top < box.scrollTop || top > box.scrollTop + box.clientHeight - 40) box.scrollTop = Math.max(0, top - 30);
    }
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
.to-piano[hidden] { display: none; }
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
.to-piano-levels button.is-on { background: var(--pn-brass); color: #2a170c; border-color: transparent; }
.to-piano .to-piano-x { width: 30px; padding: 6px 0; font-size: 16px; line-height: 1; }
.to-piano-sheet { margin-bottom: 10px; }
.to-piano-levels { display: flex; gap: 6px; margin-bottom: 8px; }
.to-piano-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 6px; }
.to-piano-list button { text-align: left; padding: 9px 11px; border-radius: 10px; font-size: 13.5px; font-weight: 600;
  background: rgba(244,232,207,.06); border: 0.5px solid rgba(244,232,207,.16); }
.to-piano-list button:hover { background: rgba(224,173,79,.18); border-color: rgba(224,173,79,.5); }
.to-piano-list small { display: block; margin-top: 2px; font: 500 11px/1.2 "DM Mono", monospace; color: var(--pn-dim); }
.to-piano-bars { display: flex; flex-wrap: wrap; gap: 6px; max-height: 118px; overflow-y: auto; padding: 8px;
  border-radius: 10px; background: #f4e8cf; color: #2a170c; position: relative; }
.to-piano-bar { display: flex; gap: 2px; padding-right: 6px; border-right: 1.5px solid rgba(42,23,12,.55); }
.to-piano-bar:last-child { border-right: 0; }
.to-piano-chip { min-width: 26px; display: flex; flex-direction: column; align-items: center; padding: 3px 4px; border-radius: 6px; transition: background .12s, opacity .12s; }
.to-piano-chip b { font: 700 15px/1.1 "DM Mono", monospace; }
.to-piano-chip i { font: 500 9.5px/1.1 "DM Mono", monospace; font-style: normal; opacity: .7; }
.to-piano-chip.is-done { opacity: .35; }
.to-piano-chip.is-next { background: #e0ad4f; box-shadow: 0 0 0 1.5px #2a170c inset; }
.to-piano-chip.is-wrong { animation: to-pn-wrong .28s; }
@keyframes to-pn-wrong { 25% { transform: translateX(-3px); background: #e86a4f; } 75% { transform: translateX(3px); } }
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
@media (max-width: 600px) {
  .to-piano { bottom: 8px; padding: 8px; }
  .to-piano-keys { height: 92px; }
  .to-piano-key i { display: none; }
  .to-piano-bars { max-height: 84px; }
}`;
  document.head.appendChild(st);
}
