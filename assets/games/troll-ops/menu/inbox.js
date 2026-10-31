// Trollnite's notifications and inbox (user, 2026-10-31: the pixel toast
// with its TV static was "very tacky"; "redesign it entirely different based
// on the aesthetic of the trollnite main menu"; it "should appear while
// you're in the main menu, not before it"; "we can add an inbox system too.
// Mail icon next to the chat icon").
//
// Every message comes through notify(): a game event (an item granted, a
// challenge done) or a site-wide TrollNotis alert (a new X post or TikTok:
// assets/js/troll-notis.js hands those to window.TrollNotisRender on this
// page instead of drawing its pixel toast). Each one
//   - goes into the inbox (kept on this device, per account; a guest's
//     their own), newest first, unread until the inbox is opened;
//   - pops as a toast in the lobby's look (navy glass, square corners, the
//     lobby's type, a yellow call to action) at the top of the screen, but
//     only once the player is in the menu: never over the boot screen, never
//     in a match. Waiting ones go one at a time.
// The inbox is Mail: the envelope in the lobby's footer, beside public chat,
// with a count of unread messages. Besides prizes, unlocks and finished
// challenges, the game sends everyone its news as letters (menu/mail.js: an
// update, an event), each once per account.

import { lettersDue } from "./mail.js?v=ml1";

const KEY = "trollops:inbox";       // { [account id | "guest"]: [message, ...] }
const MAX = 50;
const TOAST_MS = 8000;
const ICON = "assets/images/icons/favicon/grin.png";
const SENT_KEY = "trollops:mail-sent";   // { [account id | "guest"]: [letter id, ...] }


/* What each kind says over its title, and its button. */
const KINDS = {
  reward: { kicker: "New in your Locker", cta: "Open the Locker" },
  challenge: { kicker: "Challenge complete", cta: "See challenges" },
  x: { kicker: "New post on X", cta: "Open on X" },
  tiktok: { kicker: "New TikTok", cta: "Watch on TikTok" },
  news: { kicker: "Trollnite", cta: "Open" },
  mail: { kicker: "Mail from Trollnite", cta: "Open" },
};

const profile = () => window.TrollrunnerAccounts?.getCachedProfile?.() || null;
const owner = () => profile()?.id || profile()?.userId || "guest";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const safeUrl = (u) => (/^https:\/\//i.test(String(u || "")) ? String(u) : "");

function readAll() { try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch { return {}; } }
function mine() { const all = readAll()[owner()]; return Array.isArray(all) ? all : []; }
function saveMine(list) {
  const all = readAll();
  all[owner()] = list.slice(0, MAX);
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* private mode */ }
}

function ago(at) {
  const s = Math.max(0, (Date.now() - at) / 1000);
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

let ui = null;              // the mounted pieces (initInbox)
const waiting = [];         // toasts held till the menu is up
const live = new Map();     // id -> the live callback a message came with (not stored)

/* A message: { id, kind, title?, body, cta?, url?, screen? }. Stored, then
   shown as a toast as soon as the player is in the menu. The same id twice
   is one message. */
export function notify(msg, onCta, { quiet = false } = {}) {
  if (!msg?.body) return;
  const m = {
    id: String(msg.id || `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
    kind: KINDS[msg.kind] ? msg.kind : "news",
    title: String(msg.title || ""),
    body: String(msg.body),
    cta: msg.cta ? String(msg.cta) : "",
    url: safeUrl(msg.url),
    screen: msg.screen ? String(msg.screen) : "",
    at: Date.now(),
    read: false,
  };
  if (typeof onCta === "function") live.set(m.id, onCta);
  const list = mine();
  if (list.some((x) => x.id === m.id)) return;
  saveMine([m, ...list]);
  renderBadge();
  if (ui?.panel && !ui.panel.hidden) renderList();
  if (quiet) return;   // (into Mail, no toast)
  waiting.push(m);
  pump();
}

/* The game's letters (menu/mail.js) this account hasn't had: each into Mail
   once (cleared Mail doesn't bring them back); the newest pops as a toast,
   the rest arrive quietly. */
function deliverMail() {
  let sent = {};
  try { sent = JSON.parse(localStorage.getItem(SENT_KEY) || "{}") || {}; } catch {}
  const had = new Set(sent[owner()] || []);
  const due = lettersDue().filter((l) => !had.has(l.id));
  if (!due.length) return;
  due.forEach((l, i) => notify({ id: l.id, kind: "mail", title: l.title, body: l.body, cta: l.cta, screen: l.screen, url: l.url },
    null, { quiet: i < due.length - 1 }));
  sent[owner()] = [...had, ...due.map((l) => l.id)];
  try { localStorage.setItem(SENT_KEY, JSON.stringify(sent)); } catch { /* private mode */ }
}

/* The game's own news (progression/challenges.js: a challenge done) comes as
   an event, so the modules sending it don't import the menu. */
addEventListener("trollforces:notify", (e) => notify(e.detail));

/* Site-wide alerts (assets/js/troll-notis.js) come here instead of its toast. */
window.TrollNotisRender = (n) => {
  const kind = n.platform === "reward" ? "reward" : n.platform === "tiktok" ? "tiktok" : n.platform === "x" ? "x" : "news";
  notify({ id: n.id, kind, body: n.summary || "Something new.", url: n.url, screen: n.screen }, n.onCta);
  return true;
};

/* ------------------------------------------------------------ the toast */

const inMenu = () => !!ui && !document.body.classList.contains("tf-booting") && !ui.title.hidden;
let showing = false;
function pump() {
  if (showing || !waiting.length || !inMenu()) return;
  showing = true;
  const m = waiting.shift();
  const k = KINDS[m.kind];
  const t = document.createElement("div");
  t.className = "tf-toast";
  t.setAttribute("role", "status");
  t.innerHTML = `
    <img class="tf-toast-icon" src="${ICON}" alt="">
    <div class="tf-toast-text">
      <small>${esc(m.title || k.kicker)}</small>
      <p>${esc(m.body)}</p>
      ${actionable(m) ? `<button type="button" class="tf-toast-go">${esc(m.cta || k.cta)}</button>` : ""}
    </div>
    <button type="button" class="tf-toast-x" aria-label="Dismiss">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
    <i class="tf-toast-bar" style="animation-duration:${TOAST_MS}ms"></i>`;
  ui.layer.append(t);
  let timer = 0;
  const done = () => {
    if (t.classList.contains("is-out")) return;
    clearTimeout(timer);
    t.classList.add("is-out");
    setTimeout(() => { t.remove(); showing = false; pump(); }, 260);
  };
  const arm = (ms) => { clearTimeout(timer); timer = setTimeout(done, ms); };
  t.querySelector(".tf-toast-x").addEventListener("click", done);
  t.querySelector(".tf-toast-go")?.addEventListener("click", () => { act(m); markRead(m.id); done(); });
  t.addEventListener("pointerenter", () => { clearTimeout(timer); t.classList.add("is-held"); });
  t.addEventListener("pointerleave", () => { t.classList.remove("is-held"); arm(3000); });
  arm(TOAST_MS);
}

const actionable = (m) => !!(m.url || m.screen || live.has(m.id));
function act(m) {
  const cb = live.get(m.id);
  if (cb) { try { cb(); } catch (e) { console.warn("[inbox]", e); } return; }
  if (m.screen) { closeInbox(); dispatchEvent(new CustomEvent("trollforces:open-screen", { detail: m.screen })); return; }
  if (m.url) window.open(m.url, "_blank", "noopener");
}

/* ------------------------------------------------------------ the inbox */

function markRead(id) {
  const list = mine();
  const m = list.find((x) => x.id === id);
  if (!m || m.read) return;
  m.read = true;
  saveMine(list);
  renderBadge();
}
function unread() { return mine().filter((m) => !m.read).length; }

function renderBadge() {
  if (!ui) return;
  const n = unread();
  ui.badge.hidden = !n;
  ui.badge.textContent = n > 9 ? "9+" : String(n);
  ui.btn.setAttribute("aria-label", n ? `Mail, ${n} unread` : "Mail");
}

function renderList() {
  const list = mine();
  ui.list.innerHTML = list.length ? list.map((m) => {
    const k = KINDS[m.kind] || KINDS.news;
    return `<li class="tf-inbox-item${m.read ? "" : " is-unread"}" data-id="${esc(m.id)}">
      <img src="${ICON}" alt="">
      <div><small>${esc(m.title || k.kicker)} · ${esc(ago(m.at))}</small><p>${esc(m.body)}</p>
      ${actionable(m) ? `<button type="button" class="tf-inbox-go">${esc(m.cta || k.cta)}</button>` : ""}</div></li>`;
  }).join("") : `<li class="tf-inbox-empty">No mail yet. Prizes, unlocks, finished challenges and updates land here.</li>`;
}

function openInbox() {
  if (!ui) return;
  renderList();
  ui.panel.hidden = false;
  ui.btn.setAttribute("aria-expanded", "true");
  // opened: everything in it has been seen
  const list = mine();
  if (list.some((m) => !m.read)) { for (const m of list) m.read = true; saveMine(list); }
  renderBadge();
  ui.panel.querySelector(".tf-inbox-x")?.focus();
}
function closeInbox() {
  if (!ui || ui.panel.hidden) return;
  ui.panel.hidden = true;
  ui.btn.setAttribute("aria-expanded", "false");
}

/* Mount: the envelope before public chat; the toasts and the panel in the
   menu's own layer (.to-pf, the lobby's parent), last, so they stand over
   the operator's stage and its "Invite" bubbles. */
export function initInbox({ root, title, before }) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "tf-btn tf-btn--secondary to-bo2-quick to-bo2-mail";   // (not .to-bo2-chat: lookups of the chat pill must not find this)
  btn.title = "Mail";
  btn.setAttribute("aria-haspopup", "dialog");
  btn.setAttribute("aria-expanded", "false");
  btn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5A2 2 0 0 1 5.5 4.5h13a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2zM5 7l7 5.5L19 7"/></svg><b class="to-pchat-badge tf-inbox-badge" hidden></b>`;
  before.before(btn);
  const panel = document.createElement("section");
  panel.className = "tf-inbox";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Mail");
  panel.hidden = true;
  panel.innerHTML = `<header><h2>Mail</h2>
    <button type="button" class="tf-inbox-clear">Clear</button>
    <button type="button" class="tf-inbox-x" aria-label="Close Mail"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></header>
    <ol class="tf-inbox-list"></ol>`;
  const layer = root.parentElement || root;
  layer.append(panel);
  ui = { root, layer, title, btn, panel, list: panel.querySelector(".tf-inbox-list"), badge: btn.querySelector(".tf-inbox-badge") };

  btn.addEventListener("click", () => (panel.hidden ? openInbox() : closeInbox()));
  panel.querySelector(".tf-inbox-x").addEventListener("click", () => { closeInbox(); btn.focus(); });
  panel.querySelector(".tf-inbox-clear").addEventListener("click", () => { saveMine([]); renderList(); renderBadge(); });
  ui.list.addEventListener("click", (e) => {
    const go = e.target.closest(".tf-inbox-go");
    if (!go) return;
    const m = mine().find((x) => x.id === go.closest("[data-id]")?.dataset.id);
    if (m) act(m);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) { e.preventDefault(); e.stopPropagation(); closeInbox(); btn.focus(); }
  }, true);
  document.addEventListener("click", (e) => {
    if (!panel.hidden && !panel.contains(e.target) && !btn.contains(e.target)) closeInbox();
  });

  // the toasts wait for the menu: the boot screen going, a match ending
  new MutationObserver(() => pump()).observe(title, { attributes: true, attributeFilter: ["hidden"] });
  new MutationObserver(() => pump()).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  addEventListener("tf-boot-enter", () => setTimeout(pump, 600));
  // a different account: its own inbox
  addEventListener("trollrunner:auth-changed", () => { deliverMail(); renderBadge(); if (!panel.hidden) renderList(); });
  deliverMail();
  renderBadge();
  pump();
  return { notify, open: openInbox, close: closeInbox, unread };
}
