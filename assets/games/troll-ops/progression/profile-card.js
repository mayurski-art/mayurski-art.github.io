// Troll Forces profile card (prestige phase 4, design doc "Troll Forces:
// Prestige + Profile Card"). BO2's calling card: your emblem (the account
// PFP) on the left, `[CLAN] name` across your calling card, your prestige or
// rank icon and level on the right, and the headline six of your combat
// record under it.
//
// renderCard() is the markup (the Barracks preview uses it too);
// openProfileCard() shows it for anyone, from a scoreboard name, the roster,
// chat or the party row. What the match already knows about them (`hint`:
// name, level, prestige, owner, clan, card off their state messages) draws
// at once, and the rest fills in from Supabase. "Full profile" still opens
// the site's own card (troll-accounts.js).
//
// Invite (menu/invites.js, set with setInviteHandler) asks anyone online who
// isn't you to play: on an account's card, and on the guest card
// (openGuestCard) a guest's name opens, since guests have no profile.

import { getLevel, getPrestige, isOwner, tfLevelForXp } from "./progression.js?v=p5-wst-sb2-fu1-wb1-ar1-ar2-cl1-fj1-zc1-zc2-nf1-or1-rfx1-ret1-mrg1-mrc1-tw1-ars1-p416-mt2-hb4-gc1";
import { playerIconSvg, prestigeName } from "./rank-icons.js?v=rk1-or1";
import { fetchRecord } from "./record.js?v=rec1-or1-gc1";
import { zombiesAllTime } from "./leaderboard-rows.js?v=lr1-zh1-or1-nd2-gc1";
import { cardById, fetchCard, getMyCard, cleanClan } from "./calling-cards.js?v=p5-wst-sb2-fu1-wb1-ar1-ar2-cl1-fj1-zc1-zc2-nf1-or1-rfx1-ret1-mrg1-mrc1-tw1-ars1-p416-mt2-hb4-gc1";

const FALLBACK_EMBLEM = new URL("../../../images/wallpaper/trollface transparent.png", import.meta.url).href;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safeUrl = (u) => (u && !/^\s*(javascript|vbscript):/i.test(String(u)) ? String(u) : "");

function accounts() { return window.TrollrunnerAccounts; }
function myId() {
  const p = accounts()?.getCachedProfile?.();
  return p?.id || p?.userId || null;
}

/* The headline six (the Barracks shows the rest). */
function statsHtml(d) {
  if (d.guest) return `<p class="tf-card-note">Guests don't keep a combat record. Sign in and every match counts.</p>`;
  if (d.loading && !d.record) return `<p class="tf-card-note">Loading the combat record…</p>`;
  const r = d.record;
  if (!r) return `<p class="tf-card-note">No matches on the record yet.</p>${zombiesHtml(d)}`;
  const pct = (x) => `${(x * 100).toFixed(1)}%`;
  const cells = [
    ["K/D", r.kd.toFixed(2)],
    ["W/L", r.wl.toFixed(2)],
    ["SPM", Math.round(r.spm).toLocaleString()],
    ["Accuracy", pct(r.accuracy)],
    ["Headshots", r.headshots.toLocaleString()],
    ["Best streak", String(r.bestStreak)],
  ];
  return `<dl class="tf-card-stats">${cells.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>${zombiesHtml(d)}`;
}

/* Zombies, all time (leaderboard-rows.js zombiesAllTime): the runs the
   account has filed. Shown once there's at least one. */
function zombiesHtml(d) {
  const z = d.zombies;
  if (!z || !z.runs) return "";
  const cells = [["Best wave", z.bestWave], ["Zombies killed", z.kills], ["Runs", z.runs]];
  return `<p class="tf-card-sub">Zombies · all time</p><dl class="tf-card-stats">${cells.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(Number(v).toLocaleString())}</dd></div>`).join("")}</dl>`;
}

/* The rank column: prestige or rank icon and level. The owner has no level,
   so no column: the Owner badge rides the name line instead, in front of
   the clan tag (user, 2026-10-26: the column with only "Owner" in it
   "looks a bit weird"), and the calling card takes the room. */
function rankHtml(d) {
  if (!d.level) return "";
  const p = d.prestige | 0;
  return `${playerIconSvg(d.level, p, 46)}<b>LV ${d.level}</b>${p > 0 ? `<small>${esc(prestigeName(p))}</small>` : ""}`;
}

/* The card's markup. `d`: { name, avatarUrl, clan, card, level, prestige,
   owner, record, guest, loading }. */
export function renderCard(d) {
  const card = cardById(d.card);
  const clan = cleanClan(d.clan);
  const emblem = safeUrl(d.avatarUrl) || FALLBACK_EMBLEM;
  const owner = !!d.owner;
  return `<article class="tf-card" aria-label="${esc(`${clan ? `[${clan}] ` : ""}${d.name}`)}'s profile card">`
    + `<div class="tf-card-top${owner ? " no-rank" : ""}">`
    + `<div class="tf-card-emblem"><img src="${esc(emblem)}" alt=""></div>`
    + `<div class="tf-card-banner" style="background-image:url('${esc(card.src)}')" title="${esc(card.name)}">`
    + `<div class="tf-card-id">${owner ? `<i class="is-owner tf-card-owner">Owner</i>` : ""}${clan ? `<b class="tf-card-clan">[${esc(clan)}]</b>` : ""}<span class="tf-card-name">${esc(d.name)}</span></div>`
    + `</div>`
    + (owner ? "" : `<div class="tf-card-rank">${rankHtml(d)}</div>`)
    + `</div>`
    + statsHtml(d)
    + `</article>`;
}

/* Your own card's data, from what this tab already knows. */
export function myCardData(record = null, loading = false) {
  const p = accounts()?.getCachedProfile?.();
  const { clan, card } = getMyCard();
  return {
    name: p?.username || "Guest troll", avatarUrl: p?.avatarUrl || "",
    clan, card, level: getLevel(), prestige: getPrestige(), owner: isOwner(),
    record, guest: !p, loading,
  };
}

/* Someone else's, from their profile, prestige and card rows. */
async function loadOther(uid) {
  const sb = accounts()?.getClient?.();
  if (!sb) return {};
  const [prof, pres, card] = await Promise.all([
    sb.from("troll_profiles").select("username, avatar_url, xp").eq("id", uid).maybeSingle(),
    sb.from("troll_forces_prestige").select("prestige, xp_base").eq("user_id", uid).maybeSingle(),
    fetchCard(uid),
  ]);
  const out = { ...card };
  if (prof.data) {
    out.name = prof.data.username;
    out.avatarUrl = prof.data.avatar_url || "";
    out.owner = String(prof.data.username || "").toLowerCase() === "troll_runner";
    const base = Number(pres.data?.xp_base) || 0;
    out.prestige = out.owner ? 0 : Number(pres.data?.prestige) || 0;
    out.level = out.owner ? null : tfLevelForXp((Number(prof.data.xp) || 0) - base);
  }
  return out;
}

/* ── The overlay ──────────────────────────────────────────────────────── */
let overlay = null, lastFocus = null, openFor = null, inviteFor = null, inviteHandler = null;
/* fn({ viewerId, name }) -> a status line; menu/invites.js sets it. */
export function setInviteHandler(fn) { inviteHandler = fn; }
/* An account's viewer on the presence roster, or null when they're offline. */
function onlineViewer(uid) {
  try { return window.getViewerRoster?.()?.members?.find((m) => m.userId === uid)?.viewerId || null; } catch { return null; }
}

function close() {
  if (!overlay || overlay.hidden) return;
  overlay.hidden = true;
  openFor = null;
  document.removeEventListener("keydown", onKey, true);
  lastFocus?.focus?.();
}
// Esc is the game's pause key too: while the card is up it only closes this.
function onKey(e) {
  if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); close(); }
  else if (e.key === "Tab") {
    const f = [...overlay.querySelectorAll("button:not([hidden])")];
    const i = f.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
  }
}

function ensureOverlay() {
  if (overlay) return overlay;
  overlay = document.createElement("div");
  overlay.className = "tf-card-overlay";
  overlay.hidden = true;
  overlay.innerHTML = `<div class="tf-card-dialog" role="dialog" aria-modal="true" aria-label="Profile card">`
    + `<div class="tf-card-slot"></div>`
    + `<p class="tf-card-status" aria-live="polite"></p>`
    + `<div class="tf-card-actions"><button type="button" data-act="invite" class="is-invite">Invite</button><button type="button" data-act="full">Full profile</button><button type="button" data-act="close">Close</button></div>`
    + `</div>`;
  overlay.addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "close" || e.target === overlay) close();
    else if (act === "invite" && inviteFor && inviteHandler) {
      overlay.querySelector(".tf-card-status").textContent = inviteHandler(inviteFor) || "";
    }
    else if (act === "full") {
      const id = openFor;
      close();
      if (id) accounts()?.openProfileCard?.(id);
    }
  });
  document.body.appendChild(overlay);
  return overlay;
}

/* Show `uid`'s card. `hint` is what the match already knows about them. */
export function openProfileCard(uid, hint = {}) {
  if (!uid) return;
  const el = ensureOverlay();
  const self = uid === myId();
  let data = self ? myCardData(null, true) : { name: hint.name || "Operator", clan: hint.clan, card: hint.card, level: hint.level, prestige: hint.prestige, owner: hint.owner, loading: true };
  const slot = el.querySelector(".tf-card-slot");
  const paint = () => { if (openFor === uid) slot.innerHTML = renderCard(data); };
  openFor = uid;
  if (el.hidden) lastFocus = document.activeElement;
  el.querySelector('[data-act="full"]').hidden = !accounts()?.openProfileCard;
  setInvite(self ? null : onlineViewer(uid), hint.name || "Operator");
  el.hidden = false;
  paint();
  document.removeEventListener("keydown", onKey, true);
  document.addEventListener("keydown", onKey, true);
  el.querySelector('[data-act="close"]').focus();

  if (!self) loadOther(uid).then((o) => { data = { ...data, ...o }; paint(); if (inviteFor && o.name) inviteFor.name = o.name; }).catch(() => {});
  zombiesAllTime(uid).then((zombies) => { data = { ...data, zombies }; paint(); }).catch(() => {});
  fetchRecord(uid)
    .then((record) => { data = { ...data, record, loading: false }; paint(); })
    .catch(() => { data = { ...data, loading: false }; paint(); });
}

/* The Invite button: shown for someone online who isn't you. */
function setInvite(vid, name) {
  inviteFor = vid && inviteHandler ? { viewerId: vid, name } : null;
  overlay.querySelector('[data-act="invite"]').hidden = !inviteFor;
  overlay.querySelector(".tf-card-status").textContent = "";
}

/* A guest's card (no account, no record): their GuestNNN name and Invite. */
export function openGuestCard({ viewerId, name }) {
  if (!viewerId) return;
  const el = ensureOverlay();
  openFor = null;
  if (el.hidden) lastFocus = document.activeElement;
  el.querySelector('[data-act="full"]').hidden = true;
  el.querySelector(".tf-card-slot").innerHTML = renderCard({ name: name || "Guest", guest: true });
  setInvite(viewerId, name || "Guest");
  el.hidden = false;
  document.removeEventListener("keydown", onKey, true);
  document.addEventListener("keydown", onKey, true);
  (el.querySelector('[data-act="invite"]:not([hidden])') || el.querySelector('[data-act="close"]')).focus();
}

export function closeProfileCard() { close(); }
