// Troll Ops — in-game radio.
//
// A separate playlist from Troll Radio (assets/js/troll-radio-tracks.js):
// this one is local mp3s, not Spotify embeds, so it can autoplay under the
// Deploy click (the same gesture that unlocks GameAudio) and keep running
// seamlessly from the lobby straight into a match — Spotify's iframe can't
// do that without reloading. One <audio> element, one widget, mounted once
// and shown in both the title screen and the HUD via CSS (see .to-radio).

const TRACKS = [
  { title: "Holy Water", artist: "Yeat", src: "assets/games/troll-ops/music/holy-water.mp3" },
  { title: "Sexy Magic", artist: "CA7RIEL & Paco Amoroso, PinkPantheress, Fred again..", src: "assets/games/troll-ops/music/sexy-magic.mp3" },
  // Third track TBD — drop the file in assets/games/troll-ops/music/ and add an entry here.
];

const STATE_KEY = "trollops:radio";

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
    this.shuffle = saved.shuffle ?? false;
    this.volume = saved.volume ?? 0.5;
    this.el.volume = this.volume;
    if (this.shuffle) this._reshuffle(saved.trackIndex);
    else if (saved.trackIndex != null) this.pos = this.order.indexOf(saved.trackIndex);
    if (this.pos < 0) this.pos = 0;

    this.el.addEventListener("ended", () => this.next());
    this.onchange = null; // set by the UI layer to repaint on track/play changes
    this._loadCurrent(false);
  }

  _load() {
    try { return JSON.parse(localStorage.getItem(STATE_KEY)) || {}; }
    catch { return {}; }
  }

  _save() {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify({
        shuffle: this.shuffle,
        volume: this.volume,
        trackIndex: this.order[this.pos] ?? 0,
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

  /* Call from the same click that resumes GameAudio (Deploy), so the browser
     sees one user gesture unlocking both. Safe to call repeatedly. */
  primeAutoplay() {
    if (!this.hasTracks || this.playing) return;
    this._playEl();
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

  _reshuffle(keepIndex) {
    const cur = keepIndex ?? this.order[this.pos] ?? 0;
    this.order = this.tracks.map((_, i) => i);
    for (let i = this.order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.order[i], this.order[j]] = [this.order[j], this.order[i]];
    }
    // Keep the currently-playing track in front so toggling shuffle mid-song
    // doesn't jump you elsewhere.
    const at = this.order.indexOf(cur);
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
