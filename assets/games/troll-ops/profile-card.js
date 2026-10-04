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

import { getLevel, getPrestige, isOwner, tfLevelForXp } from "./progression.js?v=p5-wst";
import { playerIconSvg, prestigeName } from "./rank-icons.js?v=rk1";
import { fetchRecord } from "./record.js?v=rec1";
import { cardById, fetchCard, getMyCard, cleanClan } from "./calling-cards.js?v=p5-wst";

const FALLBACK_EMBLEM = new URL("../../images/wallpaper/trollface transparent.png", import.meta.url).href;

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
  if (!r) return `<p class="tf-card-note">No matches on the record yet.</p>`;
  const pct = (x) => `${(x * 100).toFixed(1)}%`;
  const cells = [
    ["K/D", r.kd.toFixed(2)],
    ["W/L", r.wl.toFixed(2)],
    ["SPM", Math.round(r.spm).toLocaleString()],
    ["Accuracy", pct(r.accuracy)],
    ["Headshots", r.headshots.toLocaleString()],
    ["Best streak", String(r.bestStreak)],
  ];
  return `<dl class="tf-card-stats">${cells.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>`;
}

function rankHtml(d) {
  if (d.owner) return `<i class="is-owner">Owner</i>`;
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
  return `<article class="tf-card" aria-label="${esc(`${clan ? `[${clan}] ` : ""}${d.name}`)}'s profile card">`
    + `<div class="tf-card-top">`
    + `<div class="tf-card-emblem"><img src="${esc(emblem)}" alt=""></div>`
    + `<div class="tf-card-banner" style="background-image:url('${esc(card.src)}')" title="${esc(card.name)}">`
    + `<div class="tf-card-id">${clan ? `<b class="tf-card-clan">[${esc(clan)}]</b>` : ""}<span class="tf-card-name">${esc(d.name)}</span></div>`
    + `</div>`
    + `<div class="tf-card-rank">${rankHtml(d)}</div>`
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
let overlay = null, lastFocus = null, openFor = null;

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
    const f = [...overlay.querySelectorAll("button")];
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
    + `<div class="tf-card-actions"><button type="button" data-act="full">Full profile</button><button type="button" data-act="close">Close</button></div>`
    + `</div>`;
  overlay.addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "close" || e.target === overlay) close();
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
  el.hidden = false;
  paint();
  document.removeEventListener("keydown", onKey, true);
  document.addEventListener("keydown", onKey, true);
  el.querySelector('[data-act="close"]').focus();

  if (!self) loadOther(uid).then((o) => { data = { ...data, ...o }; paint(); }).catch(() => {});
  fetchRecord(uid)
    .then((record) => { data = { ...data, record, loading: false }; paint(); })
    .catch(() => { data = { ...data, loading: false }; paint(); });
}

export function closeProfileCard() { close(); }
