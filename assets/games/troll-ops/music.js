// Troll Forces — in-game radio.
//
// A separate playlist from Troll Radio (assets/js/troll-radio-tracks.js):
// this one is local mp3s, not Spotify embeds, so it keeps running seamlessly
// from the lobby straight into a match — Spotify's iframe can't do that
// without reloading. It never autoplays: the player has to hit Play. One <audio> element, one widget, mounted once
// and shown in both the title screen and the HUD via CSS (see .to-radio).

const TRACKS = [
  { title: "Holy Water", artist: "Yeat", src: "assets/games/troll-ops/music/holy-water.mp3" },
  { title: "Sexy Magic", artist: "CA7RIEL & Paco Amoroso, PinkPantheress, Fred again..", src: "assets/games/troll-ops/music/sexy-magic.mp3" },
  { title: "Mermaid", artist: "Train", src: "assets/games/troll-ops/music/mermaid.mp3" },
  { title: "RHYNO", artist: "Travis Scott", src: "assets/games/troll-ops/music/rhyno.mp3" },
];

// v2 made shuffle the default. The old key saved `shuffle: false` for everyone
// (it wrote the flag on any volume change), so only its volume carries over.
const STATE_KEY = "trollops:radio-v2";
const LEGACY_KEY = "trollops:radio";

// The ten bands printed under the Grinspace EQ sliders (Hz), ±12 dB each.
export const EQ_BANDS = [32, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
export const EQ_RANGE = 12;
const clampDb = (v) => Math.max(-EQ_RANGE, Math.min(EQ_RANGE, Number(v) || 0));

export class GameMusic {
  constructor() {
    this.el = new Audio();
    this.el.preload = "auto";
    this.tracks = TRACKS;
    this.order = this.tracks.map((_, i) => i);
    this.pos = 0;              // index into `order`
    this.shuffle = false;
    this.playing = false;
    this.volume = 0.5;
    this.el.volume = this.volume;

    const saved = this._load();
    this.shuffle = saved.shuffle ?? true;
    this.volume = saved.volume ?? 0.5;
    this.el.volume = this.volume;
    // A fresh shuffle each visit, so it doesn't always open on the first track.
    if (this.shuffle) this._reshuffle(null);
    else if (saved.trackIndex != null) this.pos = this.order.indexOf(saved.trackIndex);
    if (this.pos < 0) this.pos = 0;

    this.eq = EQ_BANDS.map((_, i) => clampDb(saved.eq?.[i] ?? 0));
    this.balance = Math.max(-1, Math.min(1, saved.balance ?? 0));
    this.graph = null;         // Web Audio chain, built on the first Play

    this.el.addEventListener("ended", () => this.next());
    this.onchange = null; // set by the UI layer to repaint on track/play changes
    this._loadCurrent(false);
  }

  /* Element -> 10 peaking filters -> balance -> analyser -> speakers. Built
     lazily inside a click (autoplay policy), and only once: an element can
     only ever be wired to one MediaElementSource. */
  _ensureGraph() {
    if (this.graph) {
      if (this.graph.ctx.state === "suspended") this.graph.ctx.resume().catch(() => {});
      return this.graph;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      const ctx = new AC();
      const src = ctx.createMediaElementSource(this.el);
      const filters = EQ_BANDS.map((hz, i) => {
        const f = ctx.createBiquadFilter();
        f.type = i === 0 ? "lowshelf" : i === EQ_BANDS.length - 1 ? "highshelf" : "peaking";
        f.frequency.value = hz;
        f.Q.value = 1.1;
        f.gain.value = this.eq[i];
        return f;
      });
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (pan) pan.pan.value = this.balance;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.72;
      let node = src;
      for (const f of filters) { node.connect(f); node = f; }
      if (pan) { node.connect(pan); node = pan; }
      node.connect(analyser);
      analyser.connect(ctx.destination);
      this.graph = { ctx, filters, pan, analyser };
    } catch { this.graph = null; }
    return this.graph;
  }

  get analyser() { return this.graph?.analyser || null; }
  get time() { return this.el.currentTime || 0; }
  get duration() { return Number.isFinite(this.el.duration) ? this.el.duration : 0; }

  seek(t) {
    if (!this.duration) return;
    this.el.currentTime = Math.max(0, Math.min(this.duration - 0.05, t));
  }

  setEq(i, db) {
    this.eq[i] = clampDb(db);
    if (this.graph) this.graph.filters[i].gain.value = this.eq[i];
    this._save();
  }

  resetEq() {
    for (let i = 0; i < this.eq.length; i++) this.setEq(i, 0);
  }

  setBalance(v) {
    this.balance = Math.max(-1, Math.min(1, v));
    if (this.graph?.pan) this.graph.pan.pan.value = this.balance;
    this._save();
  }

  /* Jump straight to a track from the playlist (an index into `tracks`). */
  playIndex(trackIndex) {
    if (!this.tracks[trackIndex]) return;
    const at = this.order.indexOf(trackIndex);
    this.pos = at < 0 ? 0 : at;
    this._save();
    this._loadCurrent(false);
    this.el.currentTime = 0;
    this.play();
  }

  stop() {
    this.el.pause();
    this.el.currentTime = 0;
    this.playing = false;
    this._notify();
  }

  _load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STATE_KEY));
      if (saved) return saved;
      const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY));
      return legacy?.volume != null ? { volume: legacy.volume } : {};
    } catch { return {}; }
  }

  _save() {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify({
        shuffle: this.shuffle,
        volume: this.volume,
        trackIndex: this.order[this.pos] ?? 0,
        eq: this.eq,
        balance: this.balance,
      }));
    } catch { /* private mode */ }
  }

  get current() { return this.tracks[this.order[this.pos]] || null; }
  get hasTracks() { return this.tracks.length > 0; }

  _loadCurrent(autoplay) {
    const t = this.current;
    if (!t) { this.el.removeAttribute("src"); return; }
    if (this.el.src && this.el.src.endsWith(t.src)) {
      if (autoplay) this._playEl();
      return;
    }
    this.el.src = t.src;
    if (autoplay) this._playEl();
    this._notify();
  }

  _playEl() {
    this._ensureGraph();
    this.el.play().then(() => {
      this.playing = true;
      this._notify();
    }).catch(() => {
      // Blocked without a user gesture — the UI stays on "paused" and the
      // next Play click (a real gesture) will succeed.
      this.playing = false;
      this._notify();
    });
  }

  play() {
    if (!this.hasTracks) return;
    this._playEl();
  }

  pause() {
    this.el.pause();
    this.playing = false;
    this._notify();
  }

  toggle() {
    if (this.playing) this.pause();
    else this.play();
  }

  next() {
    if (!this.hasTracks) return;
    this.pos = (this.pos + 1) % this.order.length;
    this._save();
    this._loadCurrent(this.playing);
  }

  prev() {
    if (!this.hasTracks) return;
    // Restart the current track if we're more than a couple seconds in —
    // matches how most players treat "previous".
    if (this.el.currentTime > 2.5) {
      this.el.currentTime = 0;
      return;
    }
    this.pos = (this.pos - 1 + this.order.length) % this.order.length;
    this._save();
    this._loadCurrent(this.playing);
  }

  /* `keepIndex` pins that track to the front; null shuffles everything. */
  _reshuffle(keepIndex = this.order[this.pos] ?? 0) {
    const cur = keepIndex;
    this.order = this.tracks.map((_, i) => i);
    for (let i = this.order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.order[i], this.order[j]] = [this.order[j], this.order[i]];
    }
    // Keep the currently-playing track in front so toggling shuffle mid-song
    // doesn't jump you elsewhere.
    const at = cur == null ? -1 : this.order.indexOf(cur);
    if (at > 0) { this.order.splice(at, 1); this.order.unshift(cur); }
    this.pos = 0;
  }

  setShuffle(on) {
    this.shuffle = on;
    if (on) this._reshuffle();
    else {
      const cur = this.tracks.indexOf(this.current);
      this.order = this.tracks.map((_, i) => i);
      this.pos = Math.max(0, cur);
    }
    this._save();
    this._notify();
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    this.el.volume = this.volume;
    this._save();
  }

  _notify() { this.onchange?.(); }
}
