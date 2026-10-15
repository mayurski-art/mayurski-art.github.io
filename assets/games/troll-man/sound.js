// Troll Man sound: every effect is synthesized with WebAudio, no audio files.
// The tunes are our own; nothing is copied from the arcade original.
//   TMSound.unlock()            call from any user gesture (browsers need one before audio)
//   TMSound.play(name, arg)     one-shot effects: start waka magnet power eat death bonus
//                               extra taunt block menu coin intermission
//   TMSound.setLoop(name, lvl)  background loop: "siren" | "fright" | "eyes" | null;
//                               lvl 0..1 raises the siren as the maze empties
//   TMSound.setMuted(bool)      remembered in localStorage
window.TMSound = (() => {
  "use strict";
  const VOLUME = 0.22;
  let ac = null, master = null;
  let muted = false;
  try { muted = localStorage.getItem("trollman.muted") === "1"; } catch (_) { /* storage blocked */ }
  const log = [];                                   // what was played, newest last (the tests read it)

  function unlock() {
    if (ac) {
      if (ac.state === "suspended") ac.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = muted ? 0 : VOLUME;
    master.connect(ac.destination);
  }

  const midi = m => 440 * 2 ** ((m - 69) / 12);

  // One note: wave type, frequency (sliding to f2 if given), start offset, length, volume.
  function note(type, f, at, dur, vol, f2) {
    const t = ac.currentTime + at;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.setValueAtTime(vol, t + Math.max(0.006, dur - 0.02));
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.03);
  }
  // A run of MIDI notes, one per step (null = rest).
  function seq(type, notes, step, vol, at = 0) {
    notes.forEach((m, i) => { if (m != null) note(type, midi(m), at + i * step, step * 0.88, vol); });
  }
  function noise(at, dur, vol) {
    const len = Math.max(1, Math.floor(ac.sampleRate * dur));
    const buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = ac.createBufferSource(), g = ac.createGain();
    s.buffer = buf; g.gain.value = vol;
    s.connect(g); g.connect(master);
    s.start(ac.currentTime + at);
  }

  let wakaFlip = 0, lastMagnet = 0;
  const SFX = {
    // game start: a bouncy two-second fanfare, square lead over a triangle bass
    start() {
      seq("square", [72, 76, 79, 84, 83, 79, 76, 79, 81, 77, 74, 77, 79, null, 79, 84], 0.125, 0.16);
      seq("triangle", [48, null, 55, null, 52, null, 55, null, 53, null, 57, null, 55, null, 43, null], 0.125, 0.32);
    },
    // eating a dot: two alternating chirps
    waka() {
      wakaFlip ^= 1;
      note("square", wakaFlip ? 520 : 260, 0, 0.075, 0.14, wakaFlip ? 260 : 520);
    },
    // FOMO pulling dots in: a quiet tick, at most every 30ms
    magnet() {
      if (ac.currentTime - lastMagnet < 0.03) return;
      lastMagnet = ac.currentTime;
      note("square", 900, 0, 0.03, 0.05, 1400);
    },
    // a power-up: a rising arpeggio, pitched per logo
    power(kind) {
      const base = { pump: 72, stonks: 76, fomo: 69, aster: 79 }[kind] || 72;
      seq("square", [base, base + 4, base + 7, base + 12], 0.045, 0.15);
    },
    // eating a chaser: one big upward sweep
    eat() { note("square", 220, 0, 0.28, 0.18, 1700); },
    // the spin-out: a wobbling fall, then two blips
    death() {
      for (let i = 0; i < 10; i++) note("square", 760 - i * 55, i * 0.09, 0.09, 0.16, 640 - i * 55);
      note("square", 330, 0.98, 0.07, 0.18, 160);
      note("square", 330, 1.12, 0.07, 0.18, 160);
    },
    bonus() { seq("square", [91, 96], 0.08, 0.15); },
    extra() { for (let i = 0; i < 4; i++) note("triangle", 1320, i * 0.16, 0.12, 0.32); },
    // "Problem?": ha-ha-ha, each one dropping
    taunt() { [700, 600, 520].forEach((f, i) => note("square", f, i * 0.1, 0.075, 0.16, f * 0.7)); },
    // Aster blocking a hit: a clang
    block() { noise(0, 0.08, 0.22); note("triangle", 1600, 0, 0.35, 0.28, 1200); },
    menu() { note("square", 880, 0, 0.04, 0.1); },
    coin() { seq("square", [88, 95], 0.06, 0.15); },
    // intermission: a cheeky little chase tune, about six seconds
    intermission() {
      const lead = [76, 79, 81, 79, 76, 72, 74, 76, null, 76, 79, 81, 84, 81, 79, null,
                    77, 81, 84, 81, 77, 74, 76, 77, null, 79, 77, 76, 74, 72, 72, null,
                    76, 79, 81, 79, 76, 72, 74, 76, null, 84, 83, 81, 79, 77, 76, null];
      const bass = [48, null, 55, null, 48, null, 55, null, 53, null, 60, null, 53, null, 60, null,
                    50, null, 57, null, 50, null, 57, null, 55, null, 62, null, 55, null, 43, null,
                    48, null, 55, null, 48, null, 55, null, 53, null, 55, null, 43, null, 48, null];
      seq("square", lead, 0.13, 0.13);
      seq("triangle", bass, 0.13, 0.3);
    },
  };

  function play(name, arg) {
    log.push(name);
    if (log.length > 300) log.splice(0, log.length - 300);
    if (!ac || muted || !SFX[name]) return;
    if (ac.state === "suspended") return;
    SFX[name](arg);
  }

  // ---- background loop: one oscillator with a wobble (LFO) on its pitch ----------
  const LOOPS = {
    siren:  { type: "triangle", vol: 0.11, base: 330, span: 260, lfo: 4.5, depth: 60 },
    fright: { type: "square",   vol: 0.05, base: 180, span: 0,   lfo: 9,   depth: 40 },
    eyes:   { type: "square",   vol: 0.05, base: 880, span: 0,   lfo: 14,  depth: 220 },
  };
  let loop = null, loopName = null;     // what is sounding
  let wanted = null;                     // what the game asked for (logged on change)
  function stopLoop() {
    if (!loop) return;
    const t = ac.currentTime;
    loop.g.gain.setTargetAtTime(0, t, 0.02);
    loop.o.stop(t + 0.1); loop.l.stop(t + 0.1);
    loop = null; loopName = null;
  }
  function setLoop(name, lvl = 0) {
    if (name !== wanted) { wanted = name; log.push(`loop:${name}`); }
    if (!ac || muted || ac.state !== "running") { if (loop) stopLoop(); return; }
    if (name !== loopName) {
      stopLoop();
      if (!name) return;
      const L = LOOPS[name];
      const o = ac.createOscillator(), g = ac.createGain(), l = ac.createOscillator(), lg = ac.createGain();
      o.type = L.type;
      o.frequency.value = L.base;
      l.frequency.value = L.lfo; lg.gain.value = L.depth;
      l.connect(lg); lg.connect(o.frequency);
      g.gain.value = 0;
      g.gain.setTargetAtTime(L.vol, ac.currentTime, 0.03);
      o.connect(g); g.connect(master);
      o.start(); l.start();
      loop = { o, g, l, L }; loopName = name;
    }
    if (loop && loop.L.span) loop.o.frequency.setTargetAtTime(loop.L.base + loop.L.span * lvl, ac.currentTime, 0.2);
  }

  function setMuted(m) {
    muted = !!m;
    try { localStorage.setItem("trollman.muted", muted ? "1" : "0"); } catch (_) { /* storage blocked */ }
    if (master) master.gain.setTargetAtTime(muted ? 0 : VOLUME, ac.currentTime, 0.01);
    if (muted && ac) stopLoop();
  }

  return {
    unlock, play, setLoop, setMuted, log,
    get muted() { return muted; },
    get running() { return !!ac && ac.state === "running"; },
  };
})();
