// Troll Forces — match chat.
//
// Only the people in your room see it: messages ride the match's own
// broadcast channel (net.sendChat / "chat" messages), nothing is stored.
// Enter opens all-chat, Y team chat (team modes; free-for-all is all-chat
// only), U the public chat (everyone on Troll Forces, menu/public-chat.js:
// it rides the site presence channel, so it works solo too); Tab while
// typing steps through the channels. Enter sends, Esc closes. While the box
// is open the game ignores its own keys (see isTyping in game.js).
//
// The log sits bottom-left in the HUD. With the box closed it only shows
// the last few lines, which fade after a while; open, it shows the history.
// A sender's name opens their profile card whenever the cursor is free
// (paused, or typing with the mouse unlocked).

const MAX_LEN = 120;
const KEEP = 40;
const SHOW_CLOSED = 6;
const FADE_MS = 9000;
const COOLDOWN_MS = 700;

export class MatchChat {
  constructor({ net, mount, isTeamMode, teamColor, openProfile, onOpenChange }) {
    this.net = net;
    this.isTeamMode = isTeamMode;
    this.teamColor = teamColor;
    this.openProfile = openProfile;
    this.onOpenChange = onOpenChange;
    this.lines = [];
    this.teamOnly = false;
    this.channel = "all";       // "all" | "team" | "public"
    this.pub = null;            // { send(text, gif) -> { name, text, gif } | { error }, live(), gifs, gifSrc } (setPublic)
    this.lastSend = 0;
    this.typing = false;

    const root = document.createElement("div");
    root.className = "to-chat";
    root.setAttribute("aria-label", "Match chat");
    const log = document.createElement("ol");
    log.className = "to-chat-log";
    log.setAttribute("role", "log");
    log.setAttribute("aria-live", "polite");
    const form = document.createElement("form");
    form.className = "to-chat-form";
    form.hidden = true;
    form.autocomplete = "off";
    const chan = document.createElement("span");
    chan.className = "to-chat-chan";
    const input = document.createElement("input");
    input.className = "to-chat-input";
    input.type = "text";
    input.maxLength = MAX_LEN;
    input.spellcheck = false;
    input.setAttribute("aria-label", "Chat message");
    form.append(chan, input);
    root.append(log, form);
    mount.appendChild(root);
    Object.assign(this, { root, log, form, chan, input });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      this.send(input.value);
      this.close();
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { e.preventDefault(); this.close(); }
      // Tab: the next channel this match has
      if (e.key === "Tab") { e.preventDefault(); this.cycle(e.shiftKey ? -1 : 1); }
      // Keep game shortcuts out of the page while typing.
      e.stopPropagation();
    });
    input.addEventListener("keyup", (e) => e.stopPropagation());
    input.addEventListener("blur", () => { if (this.typing) this.close(); });
    log.addEventListener("click", (e) => {
      const b = e.target.closest("[data-uid]");
      if (b) this.openProfile?.(b.dataset.uid);
    });
    this.render();
  }

  get isTyping() { return this.typing; }

  /* Clickable names only while the cursor is free. */
  setInteractive(on) { this.root.classList.toggle("is-interactive", !!on); }

  /* The public chat to send through (menu/public-chat.js sendPublic). */
  setPublic(pub) { this.pub = pub; }

  /* The channels open to us now: room ones need a room, public the site. */
  channels() {
    const out = [];
    if (this.net.connected) out.push("all");
    if (this.net.connected && this.isTeamMode()) out.push("team");
    if (this.pub?.live()) out.push("public");
    return out;
  }

  /* open(): all-chat; open(true) or open("team"): team; open("public"). */
  open(chan = "all") {
    if (chan === true) chan = "team";
    else if (chan === false) chan = "all";
    const have = this.channels();
    if (!have.length) return;
    if (!have.includes(chan)) chan = have.includes("all") ? "all" : have[0];
    this.setChannel(chan);
    this.typing = true;
    this.form.hidden = false;
    this.root.classList.add("is-open");
    this.input.value = "";
    this.render();
    // Focus after the key that opened the box has finished, or its
    // character (Enter/Y) lands in the input.
    // If it can't take focus (the match intro), it closes again: open with
    // nowhere to type, every game key would be swallowed.
    setTimeout(() => { this.input.focus(); if (document.activeElement !== this.input) this.close(); }, 0);
    this.onOpenChange?.(true);
  }

  setChannel(chan) {
    this.channel = chan;
    queueMicrotask(() => this.paintGifs());
    this.teamOnly = chan === "team";
    this.chan.textContent = chan === "team" ? "TEAM" : chan === "public" ? "PUBLIC" : "ALL";
    this.chan.classList.toggle("is-team", chan === "team");
    this.chan.classList.toggle("is-public", chan === "public");
    this.input.setAttribute("aria-label", chan === "public" ? "Public chat message: everyone on Troll Warfare" : "Chat message");
  }

  cycle(step) {
    const have = this.channels();
    if (have.length < 2) return;
    const i = have.indexOf(this.channel);
    this.setChannel(have.at((i + step + have.length) % have.length));
  }

  close() {
    if (!this.typing) return;
    this.typing = false;
    this.form.hidden = true;
    this.paintGifs();
    this.root.classList.remove("is-open");
    this.input.blur();
    this.render();
    this.onOpenChange?.(false);
  }

  send(text) {
    const t = String(text || "").replace(/\s+/g, " ").trim().slice(0, MAX_LEN);
    if (this.channel === "public") {
      const r = t ? this.pub?.send(t) : null;
      if (r && r.name) this.add({ name: r.name, text: r.text, gif: r.gif, pub: true, you: true });
      else if (r?.error) this.add({ name: "", text: r.error, note: true });
      return r;
    }
    if (!t || !this.net.connected) return;
    const now = performance.now();
    if (now - this.lastSend < COOLDOWN_MS) return;
    this.lastSend = now;
    const m = this.net.sendChat(t, this.teamOnly);
    this.add({ name: this.net.name, uid: this.net.uid, team: this.net.team, text: t, teamOnly: this.teamOnly, you: true });
    return m;
  }

  /* A message off the wire. Team chat from the other side is dropped here. */
  receive(peer, m) {
    const text = String(m.x || "").replace(/\s+/g, " ").trim().slice(0, MAX_LEN);
    if (!text) return;
    const teamOnly = !!m.tt;
    if (teamOnly && m.tm !== this.net.team) return;
    this.add({ name: String(m.n || peer?.name || "operator").slice(0, 24), uid: safeUid(m.u || peer?.uid), team: m.tm || peer?.team, text, teamOnly });
  }

  /* A public chat message (menu/public-chat.js), already checked. */
  receivePublic(name, text, uid = null, gif = null) {
    this.add({ name: String(name).slice(0, 24), uid: safeUid(uid), text: String(text || "").slice(0, 200), gif, pub: true });
  }

  /* A GIF to everyone (the strip over the box on the PUBLIC channel). */
  sendGif(id) {
    const r = this.pub?.send("", id);
    if (r && r.name) this.add({ name: r.name, text: "", gif: r.gif, pub: true, you: true });
    else if (r?.error) this.add({ name: "", text: r.error, note: true });
    this.input?.focus();
  }

  /* The GIF strip shows while you type on PUBLIC. */
  paintGifs() {
    const on = this.typing && this.channel === "public" && !!this.pub?.gifs?.length;
    if (on && !this.gifs) {
      this.gifs = document.createElement("div");
      this.gifs.className = "to-chat-gifs";
      this.gifs.setAttribute("role", "group");
      this.gifs.setAttribute("aria-label", "Send a GIF to everyone");
      for (const g of this.pub.gifs) {
        const b = document.createElement("button");
        b.type = "button";
        b.dataset.gif = g.id;
        const img = document.createElement("img");
        img.src = this.pub.gifSrc(g.id);
        img.alt = g.label;
        img.loading = "lazy";
        b.appendChild(img);
        // mousedown, not click: the input keeps focus, so the box stays open
        b.addEventListener("mousedown", (e) => { e.preventDefault(); this.sendGif(g.id); });
        this.gifs.appendChild(b);
      }
      this.form.before(this.gifs);
    }
    if (this.gifs) this.gifs.hidden = !on;
  }

  add(line) {
    line.at = performance.now();
    this.lines.push(line);
    if (this.lines.length > KEEP) this.lines.shift();
    this.render();
    clearTimeout(this.fadeTimer);
    this.fadeTimer = setTimeout(() => this.render(), FADE_MS + 50);
  }

  clear() { this.lines = []; this.close(); this.render(); }

  render() {
    const now = performance.now();
    const show = this.typing ? this.lines : this.lines.slice(-SHOW_CLOSED).filter((l) => now - l.at < FADE_MS);
    this.log.replaceChildren(...show.map((l) => {
      const li = document.createElement("li");
      li.className = "to-chat-line";
      if (l.note) {
        li.classList.add("is-note");
        li.textContent = l.text;
        return li;
      }
      if (l.teamOnly || l.pub) {
        const tag = document.createElement("span");
        tag.className = l.pub ? "to-chat-tag is-public" : "to-chat-tag";
        tag.textContent = l.pub ? "[PUBLIC]" : "[TEAM]";
        li.appendChild(tag);
      }
      const name = document.createElement(l.uid ? "button" : "span");
      name.className = "to-chat-name";
      if (l.uid) {
        name.type = "button";
        name.dataset.uid = l.uid;
        name.title = `View ${l.name}'s profile`;
      }
      name.textContent = l.you ? `${l.name} (you)` : l.name;
      const color = !l.pub && this.teamColor?.(l.team);
      if (color && this.isTeamMode()) name.style.color = color;
      const text = document.createElement("span");
      text.className = "to-chat-text";
      text.textContent = l.text;
      li.append(name, document.createTextNode(": "), text);
      if (l.gif && this.pub?.gifSrc) {
        const img = document.createElement("img");
        img.className = "to-chat-gif";
        img.src = this.pub.gifSrc(l.gif);
        img.alt = "GIF";
        li.appendChild(img);
      }
      return li;
    }));
    // solo, the box is there for the public chat once there's any
    this.root.hidden = !this.net.connected && !this.typing && !show.length;
  }
}

/* Account ids are uuids; anything else off the wire is ignored. */
export function safeUid(v) {
  const s = String(v || "");
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) ? s : null;
}
