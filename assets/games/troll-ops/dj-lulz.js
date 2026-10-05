// Troll Forces — DJ Lulz, Trolling Loud's DJ (Socialize only).
//
// User, 2026-10-04: "users should be able to request songs to DJ Lulz and
// there should be some nice UI that pops up, whether the DJ has pending
// requests/ongoing requests". He spins the Troll Forces radio's tracks
// (music.js) for the whole room, through the booth's speakers (the map's
// muffled, placed chain: trollingloud.js `dj.input`), and the club's lights
// run on the record's beat grid (music-beats.js).
//
// Walk up to the booth and hold X: the request panel opens (now spinning,
// up next, the crate). A request goes in PENDING while DJ Lulz looks it
// over for a couple of seconds, then QUEUED; requests play in order, and
// one mixes the DJ's own pick out early. One request in line per player.
//
// No server: the room's oldest player (the same tie-break as the saloon
// bar's apron) keeps the queue and broadcasts it ("rp" k:"djstate"); times
// are on that player's clock, and everyone else keeps an offset to it, so
// the record is at the same place for the whole room. If they leave, the
// next oldest carries on from the last state they heard.

import { BEATS } from "./music-beats.js?v=bg1";

const REVIEW_MS = 2600;        // a request sits PENDING this long
const GAP_MS = 1600;           // silence between two records
const STATE_EVERY_MS = 4000;   // the keeper re-broadcasts the queue
const RESEND_MS = 2500;        // a request not seen in the queue yet goes again
const GIVE_UP_MS = 12000;
const MAX_QUEUE = 6;
const COOLDOWN_MS = 12000;     // per player, between requests
const MIN_PICK_MS = 25000;     // the DJ's own pick plays at least this long...
const MIX_OUT_MS = 6000;       // ...then a request fades it out over this
const FADE_MS = 2500;
const VOL_KEY = "trollops:dj-volume";

const clean = (s, n = 24) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const mmss = (s) => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

export class DjLulz {
  /* hooks: { net, tracks, humans() -> [{id, since}], name(), banner(text, ms),
     releaseInputs(), lock(), unlock(), isTouch, radioOn() } */
  constructor(hooks) {
    this.h = hooks;
    this.tracks = hooks.tracks;
    this.map = null;
    this.st = { seq: 0, now: null, q: [] };
    this.skew = 0; this.skewed = false;   // room clock = Date.now() + skew
    this.offs = [];
    this.lastSent = 0;
    this.lastPick = -1;
    this.cooldown = new Map();            // keeper: pid -> room ms
    this.mine = null;                     // { rid, t, sentAt, firstAt }
    this.seen = new Set();                // rids we've toasted about
    this.n = 0;
    this.inClub = false;
    this.el = new Audio();
    this.el.preload = "auto";
    this.graph = null;                    // { ctx, src, gain, input }
    this.blocked = false;
    try { this.vol = Math.max(0, Math.min(1, Number(localStorage.getItem(VOL_KEY) ?? 0.8))); } catch { this.vol = 0.8; }
    if (!Number.isFinite(this.vol)) this.vol = 0.8;
    this._buildUi();
  }

  /* ------------------------------------------------------------ the room */

  /* The map's DJ (trollingloud.js `dj`) in Socialize, or null anywhere else. */
  setMap(map) {
    const dj = map?.dj || null;
    if (dj === this.map) return;
    this.map = dj;
    this.close(true);
    this.st = { seq: 0, now: null, q: [] };
    this.skewed = false;
    this.offs = [];
    this.mine = null;
    this.seen.clear();
    this.lastSent = 0;
    this.joinAt = performance.now();
    if (!dj) { this._stopAudio(); this.ui.chip.hidden = true; return; }
    // ask whoever keeps the queue for it now, rather than in a few seconds
    this.h.net.publishRp?.({ k: "djhi" });
  }

  get active() { return !!this.map; }
  get isOpen() { return !this.ui.panel.hidden; }

  roomNow() { return Date.now() + this.skew; }

  /* The room's oldest real player keeps the queue (lowest id on a tie). */
  keeperId() {
    const net = this.h.net;
    let best = { id: net.id, since: net.since || 0 };
    if (!net.connected) return best.id;
    for (const p of this.h.humans()) {
      const since = p.since || 0;
      if (since < best.since || (since === best.since && p.id < best.id)) best = { id: p.id, since };
    }
    return best.id;
  }
  isKeeper() {
    // just in: hear the room out before deciding we're the oldest in it
    if (this.h.net.connected && !this.st.seq && performance.now() - this.joinAt < 1500) return false;
    return this.keeperId() === this.h.net.id;
  }

  _dur(t) { return (BEATS[this.tracks[t]?.src]?.dur ?? 180) * 1000; }
  _end(now) { return now ? (now.end ?? now.at + this._dur(now.t)) : 0; }

  _broadcast() {
    this.st.seq++;
    this.lastSent = performance.now();
    const { seq, now, q } = this.st;
    this.h.net.publishRp?.({ k: "djstate", seq, rn: this.roomNow(), now, q });
    this._react();
    this._render();
  }

  /* Off the wire (net "rp" with a "dj" k). */
  onMessage(p, m) {
    if (!this.map || !p) return;
    if (m.k === "djstate") {
      const sender = p.id, keeper = this.keeperId();
      if (!(m.seq > this.st.seq || (m.seq === this.st.seq && sender === keeper))) return;
      if (sender === keeper && Number.isFinite(m.rn)) {
        // Their clock minus ours, as seen: the trip only ever makes it look
        // smaller, so the least-delayed of the last few is the best guess.
        this.offs.push(m.rn - Date.now());
        if (this.offs.length > 12) this.offs.shift();
        this.skew = Math.max(...this.offs);
        this.skewed = true;
      }
      this.st = { seq: m.seq | 0, now: this._cleanNow(m.now), q: (Array.isArray(m.q) ? m.q : []).slice(0, MAX_QUEUE + 2).map((e) => this._cleanEntry(e)).filter(Boolean) };
      this._react();
      this._render();
    } else if (m.k === "djhi") {
      if (this.isKeeper()) this._broadcast();
    } else if (m.k === "djreq") {
      if (this.isKeeper()) this._take(p.id, m.name || p.name, m.rid, m.track);
    } else if (m.k === "djno") {
      if (m.to !== this.h.net.id || !this.mine || this.mine.rid !== m.rid) return;
      this.mine = null;
      this.h.banner(`DJ Lulz: ${clean(m.why, 60) || "not right now"}`, 2400);
      this._render();
    }
  }

  _cleanNow(n) {
    if (!n || !this.tracks[n.t | 0]) return null;
    return { t: n.t | 0, by: n.by ? clean(n.by) : null, pid: n.pid ? clean(n.pid, 64) : null, rid: n.rid ? clean(n.rid, 80) : null, at: +n.at || 0, end: Number.isFinite(n.end) ? n.end : undefined };
  }
  _cleanEntry(e) {
    if (!e || !this.tracks[e.t | 0] || !e.rid) return null;
    return { rid: clean(e.rid, 80), t: e.t | 0, by: clean(e.by) || "someone", pid: clean(e.pid, 64), ok: e.ok ? 1 : 0, rev: +e.rev || 0 };
  }

  /* The keeper: a request in (ours goes straight here). */
  _take(pid, name, rid, t) {
    rid = clean(rid, 80); t = Number(t);
    const S = this.st, rn = this.roomNow();
    if (!rid || S.q.some((e) => e.rid === rid) || S.now?.rid === rid) return;   // a resend
    const no = (why) => {
      if (pid === this.h.net.id) this.onMessage({ id: pid }, { k: "djno", to: pid, rid, why });
      else this.h.net.publishRp?.({ k: "djno", to: pid, rid, why });
    };
    if (!Number.isInteger(t) || !this.tracks[t]) return no("never heard of it");
    if (S.now?.t === t && rn < this._end(S.now)) return no("that one's playing right now");
    if (S.q.some((e) => e.t === t)) return no("that one's already in the queue");
    if (S.q.some((e) => e.pid === pid)) return no("one request at a time, you're already in line");
    if (S.q.length >= MAX_QUEUE) return no("the queue's full, try in a bit");
    if (rn < (this.cooldown.get(pid) || 0)) return no("give it a sec");
    this.cooldown.set(pid, rn + COOLDOWN_MS);
    S.q.push({ rid, t, by: clean(name) || "someone", pid, ok: 0, rev: rn + REVIEW_MS });
    this._broadcast();
  }

  /* The keeper: requests looked over, the next record on. */
  _keep() {
    const S = this.st, rn = this.roomNow();
    let changed = false;
    for (const e of S.q) if (!e.ok && rn >= e.rev) { e.ok = 1; changed = true; }
    // a request in: the DJ's own pick mixes out (once it's had a fair go)
    if (S.now && !S.now.pid && S.now.end === undefined && S.q.some((e) => e.ok)) {
      const end = Math.max(rn + MIX_OUT_MS, S.now.at + MIN_PICK_MS);
      if (end < this._end(S.now)) { S.now.end = end; changed = true; }
    }
    if (!S.now || rn >= this._end(S.now)) {
      const next = S.q.shift();
      let t, by = null, pid = null, rid = null;
      if (next) ({ t, by, pid, rid } = next);
      else {
        // DJ's pick: anything but what just played
        const last = S.now ? S.now.t : this.lastPick;
        const pool = this.tracks.map((_, i) => i).filter((i) => i !== last || this.tracks.length === 1);
        t = pool[Math.floor(Math.random() * pool.length)];
      }
      this.lastPick = t;
      S.now = { t, by, pid, rid, at: rn + (S.now ? GAP_MS : 400) };
      changed = true;
    }
    if (changed || performance.now() - this.lastSent > STATE_EVERY_MS) this._broadcast();
  }

  /* Ours: ask for track `t`. */
  request(t) {
    if (!this.map || !this.tracks[t]) return;
    const why = this.blockReason(t);
    if (why) { this.h.banner(why, 1800); return; }
    const rid = `${this.h.net.id}:${Date.now().toString(36)}${++this.n}`;
    this.mine = { rid, t, sentAt: performance.now(), firstAt: performance.now() };
    this._send();
    this._render();
  }
  _send() {
    const m = this.mine;
    m.sentAt = performance.now();
    if (this.isKeeper()) this._take(this.h.net.id, this.h.name(), m.rid, m.t);
    // (not `t`: publishRp spreads this over the wire message, whose `t` is its type)
    else this.h.net.publishRp?.({ k: "djreq", rid: m.rid, track: m.t, name: clean(this.h.name()) });
  }

  /* Why the crate's button for `t` is off, or null. */
  blockReason(t) {
    const S = this.st, me = this.h.net.id;
    if (S.now?.t === t && this.roomNow() < this._end(S.now)) return "That one's playing right now";
    if (S.q.some((e) => e.t === t)) return "Already in the queue";
    if (this.mine || S.q.some((e) => e.pid === me)) return "You've got one in line";
    if (S.q.length >= MAX_QUEUE) return "The queue's full";
    return null;
  }

  /* Toasts for what changed: ours seen, ours up, someone's in. */
  _react() {
    const me = this.h.net.id, S = this.st;
    if (this.mine) {
      const e = S.q.find((x) => x.rid === this.mine.rid);
      if (e || S.now?.rid === this.mine.rid) this.mine = null;   // it's in: the queue tracks it now
    }
    for (const e of S.q) {
      const key = `${e.rid}:${e.ok}`;
      if (this.seen.has(key)) continue;
      this.seen.add(key);
      if (e.pid === me) this.h.banner(e.ok ? `DJ Lulz is on it: ${this.tracks[e.t].title} is #${S.q.indexOf(e) + 1} in line` : "Request sent, DJ Lulz is checking it…", 2200);
      else if (e.ok && this.inClub) this.h.banner(`${e.by} requested ${this.tracks[e.t].title}`, 1600);
    }
    if (S.now?.rid && !this.seen.has(`${S.now.rid}:on`)) {
      this.seen.add(`${S.now.rid}:on`);
      if (S.now.pid === me) this.h.banner(`Now playing your request: ${this.tracks[S.now.t].title}`, 2600);
    }
  }

  /* ------------------------------------------------------------ the frame */

  /* Every frame in a match. `pos` is the player's feet. */
  update(dt, pos) {
    if (!this.map) return;
    if (this.isKeeper()) this._keep();
    // ours, not in the queue yet: again, or give up
    if (this.mine) {
      const t = performance.now();
      if (t - this.mine.firstAt > GIVE_UP_MS) { this.mine = null; this.h.banner("DJ Lulz didn't catch that. Try again", 2000); }
      else if (t - this.mine.sentAt > RESEND_MS) this._send();
    }
    const c = this.map.club;
    this.inClub = !!pos && pos.x > c.x0 && pos.x < c.x1 && pos.z > c.z0 && pos.z < c.z1 && pos.y < c.top;
    this._syncAudio();
    this._frameUi();
  }

  /* What's playing for the lights (trollingloud.js onFrame `song`). */
  song() {
    const n = this.map && this.st.now;
    if (!n) return null;
    const tr = this.tracks[n.t];
    const room = (this.roomNow() - n.at) / 1000;
    // the record as we hear it, if it's really going (not stalled, seeking
    // or off); else where the room is in it, so the lights never stop
    const el = this.el;
    const ours = !el.paused && !el.seeking && el.readyState >= 3 && !this.blocked && el.src.endsWith(tr.src) && Math.abs(el.currentTime - room) < 1;
    return { src: tr.src, t: ours ? el.currentTime : room, dj: true };
  }

  /* Hold X at the booth (game.js's prompt). */
  action(pos) {
    const s = this.map?.spot;
    if (!s || !pos || this.isOpen) return null;
    if (Math.hypot(pos.x - s.x, pos.z - s.z) > s.reach || Math.abs(pos.y - s.y) > 1.3) return null;
    const pending = this.st.q.length;
    return {
      key: "dj", ctx: "DJ", time: 0.25,
      label: pending ? `Request a song from DJ Lulz (${pending} in line)` : "Request a song from DJ Lulz",
      done: () => this.open(),
    };
  }

  _connect() {
    if (this.graph) return this.graph;
    const input = this.map?.input?.();
    if (!input) return null;
    try {
      const ctx = input.context;
      const src = ctx.createMediaElementSource(this.el);
      const gain = ctx.createGain();
      src.connect(gain);
      gain.connect(input);
      this.graph = { ctx, src, gain, input };
    } catch { this.graph = null; }
    return this.graph;
  }

  _syncAudio() {
    const n = this.st.now;
    if (!n) { this._stopAudio(); return; }
    const tr = this.tracks[n.t], rn = this.roomNow();
    const pos = (rn - n.at) / 1000;
    const end = this._end(n);
    const g = this._connect();
    if (!this.el.src.endsWith(tr.src)) { this.el.src = tr.src; this.blocked = false; }
    if (pos < 0 || rn >= end) { if (!this.el.paused) this.el.pause(); return; }
    // fades: in from the top, out at a mix-out or the end
    const fade = Math.min(1, pos * 1000 / 400, (end - rn) / FADE_MS);
    const level = this.vol * Math.max(0, fade) * (this.h.radioOn() ? 0 : 1);
    if (g) g.gain.gain.setTargetAtTime(level, g.ctx.currentTime, 0.08);
    else this.el.volume = Math.min(1, level);
    if (g && g.ctx.state === "suspended") g.ctx.resume().catch(() => {});
    if (this.el.paused) {
      const d = this.el.duration;
      if (Number.isFinite(d) && pos > d - 0.1) return;   // the file ran out first
      // (once: setting it again while play() waits on data restarts the seek)
      if (!this._playing && this.el.readyState >= 1 && !this.el.seeking && Math.abs(this.el.currentTime - pos) > 0.4) this.el.currentTime = pos + 0.15;
      // blocked (no gesture yet): try again now and then, or on a click
      if (!this._playing && (!this.blocked || performance.now() > (this._retryAt || 0))) {
        this._retryAt = performance.now() + 2000;
        this._playing = true;
        this.el.play().then(() => { this.blocked = false; }).catch(() => { this.blocked = true; }).finally(() => { this._playing = false; });
      }
    } else if (!this.el.seeking && this.el.readyState >= 2) {
      // in step with the room: a small drift is played out (a hair fast or
      // slow), a big one is a jump, aimed a little ahead to cover the seek
      const drift = this.el.currentTime - pos, now = performance.now();
      if (Math.abs(drift) > 0.4 && now - (this._seekAt || 0) > 1500) {
        this._seekAt = now;
        this.el.currentTime = pos + 0.15;
        this.el.playbackRate = 1;
      } else this.el.playbackRate = Math.abs(drift) < 0.06 ? 1 : drift > 0 ? 0.97 : 1.03;
    }
  }

  _stopAudio() { if (!this.el.paused) this.el.pause(); }

  /* ------------------------------------------------------------ the panel */

  open() {
    if (!this.map || this.isOpen) return;
    this.h.releaseInputs();
    this.ui.panel.hidden = false;
    this.ui.panel.classList.remove("is-out");
    this._wasLocked = !this.h.isTouch;
    this._render();
    if (!this.h.isTouch) this.h.unlock();
    this.ui.close.focus({ preventScroll: true });
  }

  close(silent = false) {
    if (this.ui.panel.hidden) return;
    this.ui.panel.hidden = true;
    this.h.releaseInputs();
    if (!silent && this._wasLocked) this.h.lock();
  }

  dispose() {
    this.setMap(null);
    this.ui.root.remove();
    window.removeEventListener("keydown", this._keys, true);
  }

  _buildUi() {
    injectCss();
    const root = document.createElement("div");
    root.className = "to-dj";
    root.innerHTML = `
      <div class="to-dj-chip" hidden aria-live="polite">
        <span class="to-dj-disc" aria-hidden="true"><img alt=""></span>
        <span class="to-dj-chip-txt">
          <span class="to-dj-chip-k">DJ Lulz <b>now spinning</b></span>
          <span class="to-dj-chip-t"></span>
          <span class="to-dj-chip-s"></span>
        </span>
        <span class="to-dj-eq" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
        <span class="to-dj-chip-bar" aria-hidden="true"><i></i></span>
      </div>
      <div class="to-dj-panel" role="dialog" aria-modal="true" aria-labelledby="to-dj-title" hidden>
        <div class="to-dj-card">
          <header class="to-dj-head">
            <span class="to-dj-avatar" aria-hidden="true"><img alt=""></span>
            <div>
              <h2 id="to-dj-title">DJ Lulz</h2>
              <p class="to-dj-sub">Taking requests · one each</p>
            </div>
            <button type="button" class="to-dj-x" aria-label="Close the DJ booth">✕</button>
          </header>
          <section class="to-dj-now" aria-label="Now spinning">
            <div class="to-dj-label">Now spinning</div>
            <div class="to-dj-now-row">
              <div class="to-dj-now-txt">
                <div class="to-dj-now-t"></div>
                <div class="to-dj-now-a"></div>
                <div class="to-dj-now-by"></div>
              </div>
              <span class="to-dj-eq is-big" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>
            </div>
            <div class="to-dj-prog" aria-hidden="true"><i></i></div>
            <div class="to-dj-times"><span class="to-dj-el"></span><span class="to-dj-left"></span></div>
          </section>
          <section aria-label="Up next">
            <div class="to-dj-label">Up next <span class="to-dj-count"></span></div>
            <ol class="to-dj-queue"></ol>
          </section>
          <section aria-label="The crate">
            <div class="to-dj-label">The crate</div>
            <ul class="to-dj-crate"></ul>
          </section>
          <footer class="to-dj-foot">
            <label class="to-dj-vol">DJ volume <input type="range" min="0" max="1" step="0.05" aria-label="DJ volume"></label>
            <span class="to-dj-note" aria-live="polite"></span>
            <span class="to-dj-keys">1–${this.tracks.length} request · Esc close</span>
          </footer>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    this.ui = {
      root, chip: $(".to-dj-chip"), chipT: $(".to-dj-chip-t"), chipS: $(".to-dj-chip-s"), chipBar: $(".to-dj-chip-bar i"),
      panel: $(".to-dj-panel"), close: $(".to-dj-x"), nowT: $(".to-dj-now-t"), nowA: $(".to-dj-now-a"), nowBy: $(".to-dj-now-by"),
      prog: $(".to-dj-prog i"), el: $(".to-dj-el"), left: $(".to-dj-left"), count: $(".to-dj-count"),
      queue: $(".to-dj-queue"), crate: $(".to-dj-crate"), vol: $(".to-dj-vol input"), note: $(".to-dj-note"),
      eqs: [...root.querySelectorAll(".to-dj-eq")],
    };
    for (const img of root.querySelectorAll("img")) img.src = TROLL_URL;
    this.ui.vol.value = String(this.vol);
    this.ui.vol.addEventListener("input", () => {
      this.vol = Number(this.ui.vol.value);
      try { localStorage.setItem(VOL_KEY, String(this.vol)); } catch { /* private mode */ }
    });
    this.ui.close.addEventListener("click", () => this.close());
    // clicks on the panel are the panel's, not the game's (fire, re-lock)
    for (const ev of ["mousedown", "pointerdown", "click", "wheel"]) this.ui.panel.addEventListener(ev, (e) => e.stopPropagation());
    this.ui.panel.addEventListener("click", (e) => {
      if (this.blocked) { this._retryAt = 0; this.graph?.ctx.resume?.().catch(() => {}); }
      if (e.target === this.ui.panel) this.close();
    });
    this.ui.crate.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-t]");
      if (b && !b.disabled) this.request(Number(b.dataset.t));
    });
    // keys while it's open belong to it: 1-9 request, Esc / X closes
    this._keys = (e) => {
      if (!this.isOpen) return;
      if (e.target === this.ui.vol && e.key.startsWith("Arrow")) return;
      e.stopImmediatePropagation();
      if (e.repeat) return;
      if (e.code === "Escape" || e.code === "KeyX") { e.preventDefault(); this.close(); return; }
      const d = /^Digit([1-9])$/.exec(e.code) || /^Numpad([1-9])$/.exec(e.code);
      if (d) { e.preventDefault(); this.request(Number(d[1]) - 1); }
    };
    window.addEventListener("keydown", this._keys, true);
    (this.h.mount || document.body).appendChild(root);
  }

  /* The panel and chip contents (on a change; the bars move per frame). */
  _render() {
    const S = this.st, me = this.h.net.id, ui = this.ui;
    const n = S.now, tr = n && this.tracks[n.t];
    ui.chipT.textContent = tr ? `${tr.title} — ${tr.artist}` : "";
    ui.nowT.textContent = tr ? tr.title : "Warming up the decks…";
    ui.nowA.textContent = tr ? tr.artist : "";
    ui.nowBy.textContent = !tr ? "" : n.pid === me ? "Your request" : n.by ? `Requested by ${n.by}` : "DJ's pick";
    ui.nowBy.classList.toggle("is-mine", !!tr && n.pid === me);
    if (!this.isOpen) return;
    // up next
    const rows = [];
    let eta = n ? Math.max(0, this._end(n) - this.roomNow()) : 0;
    S.q.forEach((e, i) => {
      const t = this.tracks[e.t];
      const mine = e.pid === me;
      rows.push(`<li class="${mine ? "is-mine" : ""}">
        <span class="to-dj-pos">${i + 1}</span>
        <span class="to-dj-q-txt"><b>${esc(t.title)}</b><small>${esc(t.artist)} · ${mine ? "you" : esc(e.by)}</small></span>
        ${e.ok ? `<span class="to-dj-pill is-queued">Queued · ~${mmss(eta / 1000)}</span>` : `<span class="to-dj-pill is-pending"><i aria-hidden="true"></i>Pending</span>`}
      </li>`);
      eta += this._dur(e.t) + GAP_MS;
    });
    if (this.mine && !S.q.some((e) => e.rid === this.mine.rid)) {
      const t = this.tracks[this.mine.t];
      rows.push(`<li class="is-mine"><span class="to-dj-pos">·</span><span class="to-dj-q-txt"><b>${esc(t.title)}</b><small>${esc(t.artist)} · you</small></span><span class="to-dj-pill is-pending"><i aria-hidden="true"></i>Sending</span></li>`);
    }
    ui.queue.innerHTML = rows.length ? rows.join("") : `<li class="to-dj-empty">Nothing queued. DJ Lulz is freestyling: ask for something.</li>`;
    ui.count.textContent = S.q.length ? `(${S.q.length})` : "";
    // the crate
    ui.crate.innerHTML = this.tracks.map((t, i) => {
      const g = BEATS[t.src];
      const why = this.blockReason(i);
      const state = n?.t === i ? "Playing" : S.q.some((e) => e.t === i) ? "In line" : this.mine?.t === i ? "Sending" : null;
      return `<li>
        <span class="to-dj-key" aria-hidden="true">${i + 1}</span>
        <span class="to-dj-q-txt"><b>${esc(t.title)}</b><small>${esc(t.artist)}${g ? ` · ${Math.round(g.bpm)} BPM · ${mmss(g.dur)}` : ""}</small></span>
        <button type="button" data-t="${i}" ${why ? `disabled title="${esc(why)}"` : ""} aria-label="Request ${esc(t.title)}">${state || (why ? "Later" : "Request")}</button>
      </li>`;
    }).join("");
    ui.note.textContent = this.h.radioOn() ? "Your radio's on, so the DJ is muted for you" : this.blocked ? "Click anywhere in the panel to hear the DJ" : "";
  }

  /* Per frame: the chip's visibility, the progress bars, the EQ on the beat. */
  _frameUi() {
    const ui = this.ui, n = this.st.now;
    const show = !!n && this.inClub;
    if (ui.chip.hidden === show) ui.chip.hidden = !show;
    if (!n || (!show && !this.isOpen)) return;
    const rn = this.roomNow(), dur = this._end(n) - n.at;
    const el = Math.max(0, (rn - n.at) / 1000), p = Math.min(1, el * 1000 / dur);
    ui.chipBar.style.transform = ui.prog.style.transform = `scaleX(${p.toFixed(4)})`;
    // the beat, off the record's own grid (as the lights)
    const s = this.song(), g = s && BEATS[s.src];
    let kick = 0;
    if (g && s.t >= g.offset) {
      const f = (s.t - g.offset) * (g.bpm / 60), i = Math.floor(f);
      kick = Math.exp(-(f - i) * 4) * (0.3 + 0.7 * (+g.kick[i] || 0) / 9);
    }
    const lv = g ? (+g.level[Math.max(0, Math.floor((s.t - g.offset) * g.bpm / 60))] || 0) / 9 : 0;
    for (const eq of ui.eqs) { eq.style.setProperty("--k", kick.toFixed(3)); eq.style.setProperty("--l", lv.toFixed(3)); }
    const now = performance.now();
    if (now - (this._sTick || 0) > 250) {
      this._sTick = now;
      const q = this.st.q.length, me = this.h.net.id;
      const mineAt = this.st.q.findIndex((e) => e.pid === me);
      ui.chipS.textContent = [
        n.pid === me ? "your request" : n.by ? `req. ${n.by}` : "DJ's pick",
        mineAt >= 0 ? `you're #${mineAt + 1}` : q ? `${q} up next` : "hold X at the booth to request",
      ].join(" · ");
      if (this.isOpen) {
        ui.el.textContent = mmss(el);
        ui.left.textContent = `-${mmss((dur / 1000) - el)}`;
        // the queue's ETAs and pending state move on their own: redraw
        if (now - (this._rTick || 0) > 1000) { this._rTick = now; this._render(); }
      }
    }
  }

  debug() {
    return { keeper: this.keeperId(), isKeeper: this.isKeeper(), st: JSON.parse(JSON.stringify(this.st)), mine: this.mine, open: this.isOpen, inClub: this.inClub, paused: this.el.paused, blocked: this.blocked, src: this.el.src, time: this.el.currentTime, song: this.song(), skew: this.skew, graph: !!this.graph };
  }
}

const TROLL_URL = new URL("../../images/wallpaper/trollface%20transparent.png", import.meta.url).href;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

let cssDone = false;
function injectCss() {
  if (cssDone) return;
  cssDone = true;
  const st = document.createElement("style");
  st.textContent = `
.to-dj { --dj-pink: #ff3fb4; --dj-cyan: #3ff0ff; --dj-ink: #f4eefa; --dj-dim: rgba(244,238,250,.62); --dj-glass: rgba(18,10,28,.86); }
.to-dj-chip {
  position: absolute; top: 58px; left: 50%; transform: translateX(-50%); z-index: 12;
  display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 10px;
  min-width: 260px; max-width: min(440px, calc(100vw - 32px)); box-sizing: border-box;
  padding: 8px 14px 11px 8px; border-radius: 14px; overflow: hidden;
  background: linear-gradient(135deg, rgba(40,12,52,.82), rgba(12,8,24,.82));
  border: 0.5px solid rgba(255,63,180,.45);
  box-shadow: 0 6px 24px rgba(0,0,0,.45), 0 0 18px rgba(255,63,180,.18);
  color: var(--dj-ink); font-family: "DM Sans", sans-serif; text-shadow: none; pointer-events: none;
  animation: to-dj-in .35s cubic-bezier(.2,.9,.3,1.2);
}
.to-dj-chip[hidden] { display: none; }
@keyframes to-dj-in { from { opacity: 0; transform: translate(-50%, -8px) scale(.96); } }
.to-dj-disc {
  width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center;
  background: repeating-radial-gradient(circle, #0a0a0e 0 2px, #1c1a22 2px 3px);
  box-shadow: 0 0 0 2px rgba(255,63,180,.55); animation: to-dj-spin 1.8s linear infinite;
}
.to-dj-disc img { width: 18px; height: 18px; border-radius: 50%; background: #ff3fb4; object-fit: contain; padding: 2px; }
@keyframes to-dj-spin { to { transform: rotate(360deg); } }
.to-dj-chip-txt { display: flex; flex-direction: column; min-width: 0; line-height: 1.2; }
.to-dj-chip-k { font: 600 10px/1.2 "Oswald", sans-serif; letter-spacing: .14em; text-transform: uppercase; color: var(--dj-pink); }
.to-dj-chip-k b { color: var(--dj-dim); font-weight: 500; margin-left: 4px; }
.to-dj-chip-t { font-weight: 700; font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.to-dj-chip-s { font: 500 10.5px/1.3 "DM Mono", monospace; color: var(--dj-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.to-dj-chip-bar { position: absolute; left: 0; right: 0; bottom: 0; height: 3px; background: rgba(255,255,255,.08); }
.to-dj-chip-bar i, .to-dj-prog i { display: block; height: 100%; transform-origin: left; transform: scaleX(0); background: linear-gradient(90deg, var(--dj-pink), var(--dj-cyan)); }
.to-dj-eq { display: inline-flex; align-items: flex-end; gap: 3px; height: 22px; --k: 0; --l: 0; }
.to-dj-eq i { width: 4px; border-radius: 2px; background: linear-gradient(180deg, var(--dj-cyan), var(--dj-pink)); height: calc(18% + 82% * var(--h)); transition: height 60ms linear; }
.to-dj-eq i:nth-child(1) { --h: calc(var(--k) * 1.0); }
.to-dj-eq i:nth-child(2) { --h: calc(var(--l) * .55 + var(--k) * .35); }
.to-dj-eq i:nth-child(3) { --h: calc(var(--k) * .8 + var(--l) * .2); }
.to-dj-eq i:nth-child(4) { --h: calc(var(--l) * .7); }
.to-dj-eq i:nth-child(5) { --h: calc(var(--k) * .5 + var(--l) * .35); }
.to-dj-eq i:nth-child(6) { --h: calc(var(--l) * .5 + var(--k) * .25); }
.to-dj-eq i:nth-child(7) { --h: calc(var(--k) * .7); }
.to-dj-eq.is-big { height: 40px; gap: 4px; }
.to-dj-eq.is-big i { width: 6px; }

.to-dj-panel {
  position: absolute; inset: 0; z-index: 60; display: grid; place-items: center; padding: 16px; box-sizing: border-box;
  background: radial-gradient(80% 70% at 50% 40%, rgba(60,10,70,.45), rgba(0,0,0,.6));
  pointer-events: auto; text-shadow: none; animation: to-dj-fade .2s ease-out;
}
.to-dj-panel[hidden] { display: none; }
@keyframes to-dj-fade { from { opacity: 0; } }
.to-dj-card {
  width: min(540px, 100%); max-height: calc(100% - 8px); overflow: auto; box-sizing: border-box;
  padding: 18px 18px 14px; border-radius: 18px; color: var(--dj-ink); font-family: "DM Sans", sans-serif;
  background: linear-gradient(160deg, rgba(36,12,48,.96), rgba(12,8,22,.97) 60%);
  border: 0.5px solid rgba(255,63,180,.5);
  box-shadow: 0 24px 70px rgba(0,0,0,.6), 0 0 0 1px rgba(63,240,255,.08), 0 0 50px rgba(255,63,180,.18);
  animation: to-dj-pop .28s cubic-bezier(.2,.9,.3,1.15);
}
@keyframes to-dj-pop { from { transform: translateY(10px) scale(.97); opacity: 0; } }
.to-dj-head { display: grid; grid-template-columns: auto 1fr auto; gap: 12px; align-items: center; margin-bottom: 14px; }
.to-dj-avatar { width: 52px; height: 52px; border-radius: 50%; display: grid; place-items: center; background: radial-gradient(circle at 40% 35%, #3a1450, #12081c); box-shadow: 0 0 0 2px var(--dj-pink), 0 0 18px rgba(255,63,180,.5); }
.to-dj-avatar img { width: 40px; height: 40px; object-fit: contain; }
.to-dj-head h2 { margin: 0; font: 700 26px/1 "Oswald", sans-serif; letter-spacing: .06em; text-transform: uppercase; background: linear-gradient(90deg, var(--dj-pink), #ffb0e6 50%, var(--dj-cyan)); -webkit-background-clip: text; background-clip: text; color: transparent; }
.to-dj-sub { margin: 4px 0 0; font: 500 11px/1.2 "DM Mono", monospace; color: var(--dj-dim); }
.to-dj-x { width: 34px; height: 34px; border-radius: 10px; border: 0.5px solid rgba(255,255,255,.2); background: rgba(255,255,255,.06); color: var(--dj-ink); font-size: 14px; cursor: pointer; }
.to-dj-x:hover, .to-dj-x:focus-visible { border-color: var(--dj-pink); color: var(--dj-pink); outline: none; }
.to-dj-label { font: 600 10.5px/1 "Oswald", sans-serif; letter-spacing: .16em; text-transform: uppercase; color: var(--dj-cyan); margin: 14px 0 8px; }
.to-dj-label .to-dj-count { color: var(--dj-dim); letter-spacing: .05em; }
.to-dj-now { padding: 12px 14px 10px; border-radius: 14px; background: rgba(255,255,255,.045); border: 0.5px solid rgba(255,255,255,.1); }
.to-dj-now .to-dj-label { margin-top: 0; color: var(--dj-pink); }
.to-dj-now-row { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; }
.to-dj-now-txt { min-width: 0; }
.to-dj-now-t { font: 700 22px/1.1 "DM Sans", sans-serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.to-dj-now-a { font-size: 13px; color: var(--dj-dim); margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.to-dj-now-by { display: inline-block; margin-top: 7px; font: 600 10.5px/1 "DM Mono", monospace; color: var(--dj-dim); }
.to-dj-now-by.is-mine { color: #12081c; background: var(--dj-cyan); padding: 3px 7px; border-radius: 6px; }
.to-dj-prog { height: 4px; border-radius: 2px; background: rgba(255,255,255,.1); overflow: hidden; margin-top: 12px; }
.to-dj-times { display: flex; justify-content: space-between; font: 500 10.5px/1 "DM Mono", monospace; color: var(--dj-dim); margin-top: 6px; }
.to-dj-queue, .to-dj-crate { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.to-dj-queue li, .to-dj-crate li { display: grid; grid-template-columns: 26px 1fr auto; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 12px; background: rgba(255,255,255,.035); border: 0.5px solid rgba(255,255,255,.07); }
.to-dj-queue li.is-mine { border-color: rgba(63,240,255,.5); background: rgba(63,240,255,.07); }
.to-dj-queue li.to-dj-empty { display: block; color: var(--dj-dim); font-size: 12.5px; text-align: center; padding: 12px; }
.to-dj-pos, .to-dj-key { width: 24px; height: 24px; border-radius: 7px; display: grid; place-items: center; font: 700 12px/1 "DM Mono", monospace; background: rgba(255,255,255,.08); color: var(--dj-ink); }
.to-dj-key { background: #f4eefa; color: #12081c; box-shadow: 0 2px 0 #9a8aa8; }
.to-dj-q-txt { min-width: 0; display: flex; flex-direction: column; }
.to-dj-q-txt b { font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.to-dj-q-txt small { font: 500 10.5px/1.3 "DM Mono", monospace; color: var(--dj-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.to-dj-pill { display: inline-flex; align-items: center; gap: 6px; font: 600 10px/1 "Oswald", sans-serif; letter-spacing: .1em; text-transform: uppercase; padding: 5px 8px; border-radius: 999px; white-space: nowrap; }
.to-dj-pill.is-pending { color: #ffcf5a; background: rgba(255,207,90,.12); border: 0.5px solid rgba(255,207,90,.45); }
.to-dj-pill.is-pending i { width: 6px; height: 6px; border-radius: 50%; background: #ffcf5a; animation: to-dj-blink 0.9s ease-in-out infinite; }
.to-dj-pill.is-queued { color: var(--dj-cyan); background: rgba(63,240,255,.1); border: 0.5px solid rgba(63,240,255,.4); }
@keyframes to-dj-blink { 50% { opacity: .25; } }
.to-dj-crate button { min-width: 84px; padding: 8px 12px; border-radius: 10px; border: 0; cursor: pointer; font: 700 11px/1 "Oswald", sans-serif; letter-spacing: .1em; text-transform: uppercase; color: #12081c; background: linear-gradient(90deg, var(--dj-pink), #ff7ad0); box-shadow: 0 4px 14px rgba(255,63,180,.35); }
.to-dj-crate button:hover:not(:disabled), .to-dj-crate button:focus-visible { filter: brightness(1.12); outline: 2px solid var(--dj-cyan); outline-offset: 2px; }
.to-dj-crate button:disabled { cursor: default; color: var(--dj-dim); background: rgba(255,255,255,.07); box-shadow: none; }
.to-dj-foot { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; margin-top: 14px; font: 500 10.5px/1.2 "DM Mono", monospace; color: var(--dj-dim); }
.to-dj-vol { display: inline-flex; align-items: center; gap: 8px; }
.to-dj-vol input { width: 110px; accent-color: var(--dj-pink); }
.to-dj-note { color: #ffcf5a; flex: 1; }
.to-dj-keys { margin-left: auto; }
body.to-touch-play .to-dj-keys { display: none; }
@media (max-width: 760px) {
  .to-dj-chip { top: 48px; min-width: 0; padding: 6px 10px 9px 6px; }
  .to-dj-disc { width: 30px; height: 30px; }
  .to-dj-card { padding: 14px 12px 12px; }
  .to-dj-now-t { font-size: 18px; }
  .to-dj-head h2 { font-size: 22px; }
}
@media (prefers-reduced-motion: reduce) { .to-dj-disc { animation: none; } .to-dj-chip, .to-dj-card, .to-dj-panel { animation: none; } }
`;
  document.head.appendChild(st);
}
