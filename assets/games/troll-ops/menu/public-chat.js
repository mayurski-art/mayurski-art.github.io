// Troll Forces: the public chat (user, 2026-10-16: "adding a public chat
// button that guests can also see", "they would get a notification that
// someone is messaging. when opening the chat there should also be a
// mute/unmute chat symbol").
//
// Everyone on trollrunner.net's Troll Forces page, accounts and guests, in
// one room: a Chat pill in the title menu's footer (an unread count on it),
// the chat a panel on the right. Messages ride the site presence channel
// (assets/js/site-presence.js send/on): live only, nothing kept on a server,
// so you see what's said while you're here (the last CHAT.keep of it). Who
// said it is read off the roster (nameOf), never the message.
// A message while the panel is shut pops a notification (a card bottom
// left) unless the chat is muted: the bell in the panel's header,
// remembered on this device. In a match the public chat is a channel of the
// match chatbox instead (net/chat.js: U to type, Phantom Forces style; user,
// 2026-10-16): its lines show there, not as cards, and muted they don't.

const CHAT = {
  max: 200,        // characters a message
  keep: 60,        // messages kept on screen
  gap: 1.2,        // seconds between your messages
  toast: 5,        // seconds a notification stays up
};
const MUTE_KEY = "trollops:chat-muted";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clean = (t) => String(t ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, CHAT.max);
const time = (ms) => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

const BELL = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a6 6 0 0 0-6 6v4l-2 3h16l-2-3V9a6 6 0 0 0-6-6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M10 19a2 2 0 0 0 4 0" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
const BELL_OFF = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a6 6 0 0 0-6 6v4l-2 3h16l-2-3V9a6 6 0 0 0-6-6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M10 19a2 2 0 0 0 4 0" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 3l18 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`;

const chat = { presence: null, msgs: [], unread: 0, open: false, muted: false, lastSent: -1e9, panel: null, pill: null, toast: null, toastT: 0, lastFocus: null };
try { chat.muted = localStorage.getItem(MUTE_KEY) === "1"; } catch { /* default: on */ }

/* ── The panel ─────────────────────────────────────────────────────────── */
function build() {
  const el = document.createElement("aside");
  el.className = "to-pchat";
  el.hidden = true;
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", "Public chat");
  el.innerHTML = `<header class="to-pchat-head"><b>Public chat</b><span class="to-pchat-who"></span>`
    + `<button type="button" class="to-pchat-mute"></button>`
    + `<button type="button" class="to-pchat-close" aria-label="Close the chat">×</button></header>`
    + `<ol class="to-pchat-log" aria-live="polite"></ol>`
    + `<form class="to-pchat-form"><input type="text" maxlength="${CHAT.max}" autocomplete="off" enterkeyhint="send" placeholder="Say something to everyone online" aria-label="Message">`
    + `<button type="submit">Send</button></form>`
    + `<p class="to-pchat-note"></p>`;
  el.querySelector(".to-pchat-close").addEventListener("click", () => setOpen(false));
  el.querySelector(".to-pchat-mute").addEventListener("click", () => setMuted(!chat.muted));
  el.querySelector(".to-pchat-form").addEventListener("submit", (e) => { e.preventDefault(); send(); });
  // the game's keys stay out of the box while you type; Esc shuts the chat
  el.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
    e.stopPropagation();
  });
  el.addEventListener("keyup", (e) => e.stopPropagation());
  document.body.appendChild(el);
  chat.panel = el;
  paintMute();
}

function paintMute() {
  const b = chat.panel?.querySelector(".to-pchat-mute");
  if (!b) return;
  b.innerHTML = chat.muted ? BELL_OFF : BELL;
  b.setAttribute("aria-pressed", String(chat.muted));
  b.setAttribute("aria-label", chat.muted ? "Unmute the chat: notifications back on" : "Mute the chat: no notifications");
  b.title = chat.muted ? "Muted: no notifications. Select to unmute." : "Notifications on. Select to mute.";
  b.classList.toggle("is-muted", chat.muted);
}
function setMuted(on) {
  chat.muted = !!on;
  try { localStorage.setItem(MUTE_KEY, chat.muted ? "1" : "0"); } catch { /* this session only */ }
  paintMute();
  if (chat.muted) hideToast();
}

function render() {
  if (!chat.panel) return;
  const log = chat.panel.querySelector(".to-pchat-log");
  log.innerHTML = chat.msgs.length
    ? chat.msgs.map((m) => `<li class="${m.me ? "is-me" : ""}"><b>${esc(m.name)}</b><time>${time(m.at)}</time><p>${esc(m.text)}</p></li>`).join("")
    : `<li class="to-pchat-empty">Nobody's said anything yet. Say hi: everyone on Troll Forces sees it, guests too.</li>`;
  log.scrollTop = log.scrollHeight;
  const n = chat.presence?.count?.() || 1;
  chat.panel.querySelector(".to-pchat-who").textContent = `${n} online`;
}

function paintPill() {
  if (!chat.pill) return;
  const b = chat.pill.querySelector(".to-pchat-badge");
  b.textContent = chat.unread > 9 ? "9+" : String(chat.unread);
  b.hidden = !chat.unread;
  chat.pill.setAttribute("aria-label", chat.unread ? `Public chat, ${chat.unread} unread` : "Public chat");
}

export function setOpen(on) {
  if (!chat.panel) build();
  chat.open = !!on;
  chat.panel.hidden = !chat.open;
  chat.pill?.setAttribute("aria-expanded", String(chat.open));
  if (chat.open) {
    chat.lastFocus = document.activeElement;
    chat.unread = 0;
    paintPill();
    hideToast();
    render();
    chat.panel.querySelector("input").focus();
  } else chat.lastFocus?.focus?.();
}
export const chatOpen = () => chat.open;

/* ── Sending and receiving ─────────────────────────────────────────────── */
function note(t) { const p = chat.panel?.querySelector(".to-pchat-note"); if (p) p.textContent = t; }
function push(m) {
  chat.msgs.push(m);
  if (chat.msgs.length > CHAT.keep) chat.msgs.splice(0, chat.msgs.length - CHAT.keep);
  if (chat.open) render();
}
/* Say `text` to everyone: { name, text } when it went, else { error }
   ("" for nothing to send). The panel and the match chatbox both send
   through here. */
export function sendPublic(text) {
  text = clean(text);
  if (!text) return { error: "" };
  const t = performance.now();
  if (t - chat.lastSent < CHAT.gap * 1000) return { error: "Easy: one message a second." };
  if (!chat.presence?.live || !chat.presence.send("chat", { text })) return { error: "Not connected yet. Try again in a moment." };
  chat.lastSent = t;
  const name = chat.presence.nameOf?.(myViewer())?.name || "You";
  push({ name, text, at: Date.now(), me: true });
  return { name, text };
}
export const publicLive = () => !!chat.presence?.live;
function send() {
  const input = chat.panel.querySelector("input");
  const r = sendPublic(input.value);
  if (r.error !== undefined) { if (r.error) note(r.error); return; }
  input.value = "";
  note("");
}
let viewerIdFn = () => null;
const myViewer = () => viewerIdFn();

function onChat(d, from) {
  const text = clean(d.text);
  const who = chat.presence.nameOf(from);
  if (!text || !who) return;
  push({ name: who.name, text, at: Date.now(), me: false });
  // in a match: a line in the chatbox, Phantom Forces style
  const inMatch = !!chat.matchChat && !chat.canOpen();
  if (inMatch && !chat.muted) chat.matchChat.receivePublic(who.name, text, who.userId);
  if (chat.open) return;
  chat.unread++;
  paintPill();
  if (!chat.muted && !inMatch) showToast(who.name, text);
}

/* ── The notification ──────────────────────────────────────────────────── */
function showToast(name, text) {
  if (!chat.toast) {
    const t = document.createElement("button");
    t.type = "button";
    t.className = "to-pchat-toast";
    t.addEventListener("click", () => { hideToast(); if (chat.canOpen()) setOpen(true); });
    chat.toast = t;
  }
  const host = document.fullscreenElement || document.body;
  if (chat.toast.parentNode !== host) host.appendChild(chat.toast);
  chat.toast.innerHTML = `<small>Public chat${chat.unread > 1 ? ` · ${chat.unread} new` : ""}</small><b>${esc(name)}</b><span>${esc(text)}</span>`;
  chat.toast.setAttribute("aria-label", `New chat message from ${name}: ${text}`);
  chat.toast.hidden = false;
  clearTimeout(chat.toastT);
  chat.toastT = setTimeout(hideToast, CHAT.toast * 1000);
}
function hideToast() { if (chat.toast) chat.toast.hidden = true; clearTimeout(chat.toastT); }

/* `presence`: the site presence handle; `pill`: the footer button (its
   badge inside); `viewerId`: ours; `canOpen()`: whether the panel can open
   now (the menu is up: in a match a notification only tells you). */
export function initPublicChat({ presence, pill, viewerId, canOpen = () => true, matchChat = null }) {
  chat.presence = presence;
  // (the game makes its match chatbox after the menu: picked up when it's there)
  const hook = () => { let mc = null; try { mc = typeof matchChat === "function" ? matchChat() : matchChat; } catch { /* not made yet */ } if (mc && !chat.matchChat) { chat.matchChat = mc; mc.setPublic?.({ send: sendPublic, live: publicLive }); } };
  hook();
  chat.pill = pill;
  chat.canOpen = canOpen;
  viewerIdFn = viewerId;
  pill.setAttribute("aria-haspopup", "dialog");
  pill.setAttribute("aria-expanded", "false");
  pill.addEventListener("click", () => setOpen(!chat.open));
  paintPill();
  presence.on?.("chat", onChat);
  // the menu went (a match started): the panel goes with it
  setInterval(() => { hook(); if (chat.open && !chat.canOpen()) setOpen(false); }, 500);
}
