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
  { title: "Werewolf (feat. Bring Me The Horizon)", artist: "Lil Uzi Vert", src: "assets/games/troll-ops/music/werewolf.mp3" },
  { title: "soooo high", artist: "Destroy Lonely", src: "assets/games/troll-ops/music/soooo-high.mp3" },
  { title: "Start Wit Me (feat. Gunna)", artist: "Roddy Ricch", src: "assets/games/troll-ops/music/start-wit-me.mp3" },
  { title: "São Paulo (feat. Anitta)", artist: "The Weeknd", src: "assets/games/troll-ops/music/sao-paulo.mp3" },
  { title: "Fell In Love", artist: "Lil Tecca, Ken Carson", src: "assets/games/troll-ops/music/fell-in-love.mp3" },
  { title: "Life Is Good (feat. Drake)", artist: "Future", src: "assets/games/troll-ops/music/life-is-good.mp3" },
  { title: "i need meds", artist: "Lil Yachty", src: "assets/games/troll-ops/music/i-need-meds.mp3" },
  { title: "Mob Guys", artist: "Young Stoner Life, Young Thug", src: "assets/games/troll-ops/music/mob-guys.mp3" },
  { title: "bloody mary (feat. Ken Carson)", artist: "lil Shordie Scott", src: "assets/games/troll-ops/music/bloody-mary.mp3" },
  { title: "Ghostface Killers (feat. Travis Scott)", artist: "21 Savage, Offset, Metro Boomin", src: "assets/games/troll-ops/music/ghostface-killers.mp3" },
  { title: "OUT WEST (feat. Young Thug)", artist: "JACKBOYS, Travis Scott", src: "assets/games/troll-ops/music/out-west.mp3" },
  { title: "GATTI", artist: "JACKBOYS, Pop Smoke, Travis Scott", src: "assets/games/troll-ops/music/gatti.mp3" },
  { title: "DArkSide", artist: "Bring Me The Horizon", src: "assets/games/troll-ops/music/darkside.mp3" },
  { title: "Natural Habitat (feat. Ken Carson)", artist: "070 Shake, Ken Carson", src: "assets/games/troll-ops/music/natural-habitat.mp3" },
  { title: "Headlines", artist: "Drake", src: "assets/games/troll-ops/music/headlines.mp3" },
  { title: "Hold That Heat (feat. Travis Scott)", artist: "Southside, Future", src: "assets/games/troll-ops/music/hold-that-heat.mp3" },
  { title: "Breathe", artist: "Yeat", src: "assets/games/troll-ops/music/breathe.mp3" },
  { title: "Griddlë (feat. Don Toliver)", artist: "Yeat", src: "assets/games/troll-ops/music/griddle.mp3" },
];

// v2 made shuffle the default. The old key saved `shuffle: false` for everyone
// (it wrote the flag on any volume change), so only its volume carries over.
const STATE_KEY = "trollops:radio-v2";
const LEGACY_KEY = "trollops:radio";

// The ten bands printed under the Grinspace EQ sliders (Hz), ±12 dB each.
export const EQ_BANDS = [32, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
export const EQ_RANGE = 12;
const clampDb = (v) => Math.max(-EQ_RANGE, Math.min(EQ_RANGE, Number(v) || 0));
// The earbuds stage (setEarbuds): in your ears it passes everything; out,
// hanging at your chest, what leaks from them is thin and quiet.
const BUD_IN = { hp: 10, lp: 22000, tin: 0, gain: 1 };
const BUD_OUT = { hp: 620, lp: 3200, tin: 6, gain: 0.26 };

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
    this.earbuds = 1;          // setEarbuds: 1 in (as it always was), 0 hanging out

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
      // The earbuds (setEarbuds): see-through while they're in, the leak
      // off buds hanging at your chest once they're out.
      const bud = {
        hp: ctx.createBiquadFilter(), lp: ctx.createBiquadFilter(), tin: ctx.createBiquadFilter(), gain: ctx.createGain(),
      };
      bud.hp.type = "highpass"; bud.hp.frequency.value = BUD_IN.hp; bud.hp.Q.value = 0.7;
      bud.lp.type = "lowpass"; bud.lp.frequency.value = BUD_IN.lp; bud.lp.Q.value = 0.7;
      bud.tin.type = "peaking"; bud.tin.frequency.value = 2400; bud.tin.Q.value = 1.3; bud.tin.gain.value = BUD_IN.tin;
      bud.gain.gain.value = BUD_IN.gain;
      let node = src;
      for (const f of filters) { node.connect(f); node = f; }
      if (pan) { node.connect(pan); node = pan; }
      for (const f of [bud.hp, bud.lp, bud.tin, bud.gain]) { node.connect(f); node = f; }
      node.connect(analyser);
      analyser.connect(ctx.destination);
      this.graph = { ctx, filters, pan, analyser, bud };
      this._applyEarbuds(0);
    } catch { this.graph = null; }
    return this.graph;
  }

  /* The earbuds (Royale's drop cinematic, modes/royale-cine.js): 1 in your
     ears (the song close, full and dry: the chain untouched), 0 out and
     hanging at your chest (a quiet, tinny leak: no bass, no top, a nasal
     bump at 2.4 kHz, a quarter of the level), in between as they come out.
     Glided, not stepped (`tc` s), so a frame's change never clicks. */
  setEarbuds(k, tc = 0.05) {
    k = Math.max(0, Math.min(1, k));
    if (Math.abs(k - this.earbuds) < 0.002) return;
    this.earbuds = k;
    this._applyEarbuds(tc);
  }
  _applyEarbuds(tc) {
    const b = this.graph?.bud;
    if (!b) return;
    const out = 1 - this.earbuds, now = this.graph.ctx.currentTime;
    const glide = (p, v) => {
      if (!tc) { p.cancelScheduledValues(0); p.value = v; return; }
      if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(now); else p.cancelScheduledValues(now);
      p.setTargetAtTime(v, now, tc);
    };
    // Frequencies glide on a log scale (what the ear hears as even).
    glide(b.hp.frequency, BUD_IN.hp * Math.pow(BUD_OUT.hp / BUD_IN.hp, out));
    glide(b.lp.frequency, BUD_IN.lp * Math.pow(BUD_OUT.lp / BUD_IN.lp, out));
    glide(b.tin.gain, BUD_IN.tin + (BUD_OUT.tin - BUD_IN.tin) * out);
    glide(b.gain.gain, BUD_IN.gain + (BUD_OUT.gain - BUD_IN.gain) * out);
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
