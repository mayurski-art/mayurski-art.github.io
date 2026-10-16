// Troll Forces — match chat.
//
// Only the people in your room see it: messages ride the match's own
// broadcast channel (net.sendChat / "chat" messages), nothing is stored.
// Enter opens all-chat, Y team chat (team modes; free-for-all is all-chat
// only), Enter sends, Esc closes. While the box is open the game ignores
// its own keys (see isTyping in game.js).
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

  open(teamOnly = false) {
    if (!this.net.connected) return;
    this.teamOnly = !!teamOnly && this.isTeamMode();
    this.typing = true;
    this.form.hidden = false;
    this.root.classList.add("is-open");
    this.chan.textContent = this.teamOnly ? "TEAM" : "ALL";
    this.chan.classList.toggle("is-team", this.teamOnly);
    this.input.value = "";
    this.render();
    // Focus after the key that opened the box has finished, or its
    // character (Enter/Y) lands in the input.
    setTimeout(() => this.input.focus(), 0);
    this.onOpenChange?.(true);
  }

  close() {
    if (!this.typing) return;
    this.typing = false;
    this.form.hidden = true;
    this.root.classList.remove("is-open");
    this.input.blur();
    this.render();
    this.onOpenChange?.(false);
  }

  send(text) {
    const t = String(text || "").replace(/\s+/g, " ").trim().slice(0, MAX_LEN);
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
      if (l.teamOnly) {
        const tag = document.createElement("span");
        tag.className = "to-chat-tag";
        tag.textContent = "[TEAM]";
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
      const color = this.teamColor?.(l.team);
      if (color && this.isTeamMode()) name.style.color = color;
      const text = document.createElement("span");
      text.className = "to-chat-text";
      text.textContent = l.text;
      li.append(name, document.createTextNode(": "), text);
      return li;
    }));
    this.root.hidden = !this.net.connected;
  }
}

/* Account ids are uuids; anything else off the wire is ignored. */
export function safeUid(v) {
  const s = String(v || "");
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) ? s : null;
}
