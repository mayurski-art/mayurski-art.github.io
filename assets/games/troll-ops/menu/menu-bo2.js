/* Troll Forces main menu, Black Ops 2 Zombies style: plain stacked text
   lists (assets/js/bo2-menu.js) over the molten troll-map planet
   (assets/js/menu-globe.js), shared with the trollrunner.net home.

   It does not reimplement the lobby. game.js and loadout.js still build
   every list (modes, maps, weapons, attachments, gear, streaks, faces) and
   own all state; this module reads those buttons and clicks them, so a
   change there shows up here with no extra wiring. The old tab bar is
   still clicked under the hood (showLobbyPanel), which keeps the gun and
   operator previews mounting exactly as before. The old panel container
   (#to-pf-center) moves into the right-hand detail pane, with the parts
   that became lists hidden by CSS. */

import { createBo2Menu } from "../../../js/bo2-menu.js?v=to-ft2-tb1";
import { createMapMode } from "../../../js/troll-map-mode.js?v=to-bo2d";
import { joinSitePresence, viewerId } from "../../../js/site-presence.js?v=to-bo2d-ol1-iv1";
import { initInvites, invitePlayer } from "./invites.js?v=iv1-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2";
import { initPublicChat, setChatPreview } from "./public-chat.js?v=pch1-nb2-pc2-gf1-sc1";
import { startOnline, onlinePlayers, serverList, joinServer, describe } from "./online.js?v=ol1-sv1-dj2-mg1-pd1-jb1-pl2-nh1-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2";
import { canPrestige, prestigeUp, getPrestige, prestigeUnlocked, PRESTIGE_MASTER } from "../progression/progression.js?v=p5-wst-sb2-fu1-wb1-ar1-ar2-cl1-fj1-zc1-zc2-nf1-or1";

import { fetchRecord, formatPlayed } from "../progression/record.js?v=rec1-or1";
import { WEAPON_DEFS } from "../weapons/weapons.js?v=p5bm-wst-hf1-fu1-wb1-ar1-ar2-cl1-fj1-zc1-zc2-or1";
import { CARDS, cardById, cardUnlocked, getMyCard, saveMyCard, cleanClan, withClan } from "../progression/calling-cards.js?v=p5-wst-sb2-fu1-wb1-ar1-ar2-cl1-fj1-zc1-zc2-nf1-or1";
import { renderCard, myCardData, openProfileCard, openGuestCard, setInviteHandler } from "../progression/profile-card.js?v=pc1-wst-sb2-fu1-wb1-ar1-ar2-cl1-fj1-zh1-zc1-zc2-nf1-or1-nb2";
import { shareCardOnX, saveCardPhoto } from "./card-share.js?v=cs1-wb1-ar1-ar2-cl1-fj1-zc1-zc2-nf1-or1";
import { FINISHES } from "../characters/skins.js?v=p5-wb1-or1";
import { MAPS, REWARD_MAPS } from "../maps/maps.js?v=p5tc-k9-em1-wst-tl1-bs1-tl2-sb1-rp1-dj1-cr1-db1-sb2-db2a-db2b-db2c-db3-db4-db5-gj1-fu1b7b7dc1c2f1m1u-tc3-nc1-cd1-sh1-sg1-bw1-cw1-zr10-zh1-hr2-zp1-jb1-nh1-pi1-sr1-hl1-pf1-ub1-uw1-ug5-or1-bw2-bt1";
import { setMapShot } from "../maps/map-load-screen.js?v=ml3-wst-tl1-ng1-db5-gj1-fu1-sr1-ug5-or1";
import { leaveToArcade, initExitLinks } from "./exit-links.js?v=ex1-cl1";
import { game } from "../core/state.js?v=st1";
import { inviteLink, prepareHubEntry } from "../modes/zombies/hub.js?v=zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-sv1-dj2-bf1-pd1-jb1-pl2-nh1-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2";
import { openKiosk } from "../view/zombies-kiosk.js?v=zk1-zh1-zc1-zc2-hr2-zp1-ar1-aa0-ar0-rs1-kc1-dj2-bf1-pd1-jb1-pl2-pi1-sr1-br1-hl1-pf1-ub1-uw1-ug5-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-sb1-cf1-gs2-gf1-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-bt1-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-ffa1-cp1-dom1-tn1-tn2";
import { credits } from "../modes/zombies/credits.js?v=zc1-zc2";
import { makeTrollOpsProvider } from "../progression/leaderboard-rows.js?v=lr1-zh1-or1";
const lbProvider = makeTrollOpsProvider();
import { PERK_DEFS, PERK_TIER_NAMES, PERK_TIER_COLORS, perksInTier, perkUnlocked, perkIconSvg } from "../progression/perks.js?v=pk1-cl1-bp1-fj1-zc1-zc2-nf1-or1";
import { STREAK_DEFS } from "../streaks/scorestreaks.js?v=umb1-wst-sb2-fu1-wb1-ar1-ar2-cl1-bp1-fj1-zc1-zc2-nf1-or1";
import { renderClassPreview } from "./class-preview.js?v=cp1";

/* Everything prestige unlocks, by prestige (prestige phase 5): finishes,
   calling cards and the private-match maps. */
function rewardLadder() {
  const at = Array.from({ length: PRESTIGE_MASTER + 1 }, () => []);
  for (const f of FINISHES) if (f.prestige) at[f.prestige].push(`${f.name} finish`);
  for (const w of Object.values(WEAPON_DEFS)) if (w.prestige) at[w.prestige].push(`${w.name} (gold pistol)`);
  for (const [id, p] of Object.entries(REWARD_MAPS)) at[p].push(`${MAPS[id]?.name || id} map, private matches`);
  for (const c of CARDS) if (c.prestige) at[c.prestige].push(`${c.name} calling card`);
  at[1].unshift("Prestige icon");
  return at.map((items, p) => ({ p, items })).filter((r) => r.p > 0 && r.items.length);
}

/* The combat record screen's data: the last fetch, refreshed on each visit. */
let recordView = null, recordState = "idle";
function loadRecord() {
  recordState = "loading";
  fetchRecord()
    .then((r) => { recordView = r; })
    .catch(() => {})
    .finally(() => {
      recordState = "done";
      if (menu.current() === "record") menu.refresh();
      else renderCardHost();
    });
}

const nextPrestigeName = () => (getPrestige() + 1 >= PRESTIGE_MASTER ? "Master" : `P${getPrestige() + 1}`);

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const text = (el) => (el ? el.textContent.trim().replace(/\s+/g, " ") : "");
const isOn = (b) => b.classList.contains("is-active") || b.classList.contains("is-on") || b.getAttribute("aria-pressed") === "true" || b.getAttribute("aria-checked") === "true";
const isLocked = (b) => b.disabled || b.getAttribute("aria-disabled") === "true";
const rail = (panel) => $(`#to-pf-rail [data-panel="${panel}"]`)?.click();

function ready() {
  return new Promise((res) => {
    const ok = () => $("#to-lo-mode .to-lo-modebtn") && $("#to-lo-maps .to-lo-map") && $("#to-lo-list .to-lo-weapon");
    if (ok()) return res();
    const t = setInterval(() => { if (ok()) { clearInterval(t); res(); } }, 100);
  });
}

await ready();

const title = $("#to-title");
const pf = $("#to-pf");
const center = $("#to-pf-center");

/* ── DOM ──────────────────────────────────────────────────────────────── */
const root = document.createElement("div");
root.className = "to-bo2";
root.innerHTML = `
  <div class="to-bo2-bg" aria-hidden="true"></div>
  <a class="to-bo2-brand" href="/" aria-label="Troll Runner home">TROLL <em>FORCES</em></a>
  <nav class="to-bo2-menu" aria-label="Troll Forces menu"></nav>
  <aside class="to-bo2-party" aria-label="Party">
    <span class="to-bo2-party-lbl"></span>
    <button type="button" class="to-bo2-party-row"><i class="to-bo2-lv"></i><b class="to-bo2-name">Guest</b></button>
    <span class="to-bo2-xp"></span>
    <section class="to-bo2-chatcard" aria-label="Public chat">
      <header><b>Public chat</b><button type="button" class="tf-btn tf-btn--secondary to-bo2-quick to-bo2-chat">Open<b class="to-pchat-badge" hidden></b></button></header>
      <ol class="to-bo2-chatcard-log"></ol>
    </section>
  </aside>
  <section class="to-bo2-detail" aria-live="polite">
    <figure class="to-bo2-mapshot" hidden><img alt=""><figcaption></figcaption></figure>
    <div class="to-bo2-lb" hidden></div>
  </section>
  <footer class="to-bo2-foot">
    <div>
      <div class="to-bo2-online">1 Online</div>
      <span class="to-bo2-status"></span>
      <span class="to-bo2-dl" aria-live="polite"><i></i><b></b></span>
      <button type="button" class="to-bo2-back"><kbd>Esc</kbd>Back</button>
    </div>
    <button type="button" class="tf-btn tf-btn--secondary to-bo2-quick" data-go="barracks">Barracks</button>
    <button type="button" class="tf-btn tf-btn--secondary to-bo2-quick" data-go="options">Options</button>
  </footer>`;
pf.prepend(root);
const nav = $(".to-bo2-menu", root);
const detail = $(".to-bo2-detail", root);
const shot = $(".to-bo2-mapshot", root);
const lbHost = $(".to-bo2-lb", root);
detail.appendChild(center);
title.classList.add("is-bo2");

/* ── Barracks: your profile card in the detail pane (profile-card.js) ──── */
const cardHost = document.createElement("div");
cardHost.className = "to-bo2-card";
cardHost.hidden = true;
cardHost.innerHTML = `<div class="to-bo2-card-slot"></div><p class="to-bo2-cardnote" hidden></p>`
  + `<div class="to-bo2-card-share" hidden><button type="button" data-act="share">Share on X</button><button type="button" data-act="photo">Save as photo</button></div>`
  + `<form class="to-bo2-clan" hidden><label for="to-bo2-clan-in">Clan tag</label>`
  + `<input id="to-bo2-clan-in" maxlength="4" autocomplete="off" spellcheck="false" aria-describedby="to-bo2-clan-help">`
  + `<button type="submit">Save</button><button type="button" data-act="cancel">Cancel</button>`
  + `<small id="to-bo2-clan-help">Up to 4 letters or numbers. Leave it empty for no tag. Enter saves, Esc cancels.</small></form>`;
detail.prepend(cardHost);
const clanForm = $(".to-bo2-clan", cardHost);
const clanIn = $("input", clanForm);
let clanEditing = false, previewCard = null;
const myUid = () => { const p = window.TrollrunnerAccounts?.getCachedProfile?.(); return p?.id || p?.userId || null; };
const setStatus = (t) => { $(".to-bo2-status", root).textContent = t; };
// The site presence roster, kept current below (Who's Online, Server Browser).
let roster = { members: [], guests: [] };

function renderCardHost() {
  if (cardHost.hidden) return;
  const d = myCardData(recordView, recordState === "loading");
  if (previewCard) d.card = previewCard;
  if (clanEditing) d.clan = cleanClan(clanIn.value);
  $(".to-bo2-card-slot", cardHost).innerHTML = renderCard(d);
  shownCard = d;
  const note = $(".to-bo2-cardnote", cardHost);
  note.hidden = !previewCard;
  note.textContent = previewCard ? cardById(previewCard).desc : "";
  clanForm.hidden = !clanEditing;
  // Share / save: your own card, signed in, in the Barracks proper.
  $(".to-bo2-card-share", cardHost).hidden = lastScreen !== "barracks" || clanEditing || d.guest;
}
let shownCard = null;
cardHost.addEventListener("click", async (e) => {
  const act = e.target.closest("[data-act]")?.dataset.act;
  if (!shownCard || (act !== "share" && act !== "photo")) return;
  if (act === "share") { shareCardOnX(shownCard); return; }
  setStatus("Saving your card…");
  try { await saveCardPhoto(shownCard); setStatus("Card saved as a photo."); }
  catch { setStatus("Couldn't save the photo."); }
});
function stopClan() {
  clanEditing = false;
  renderCardHost();
  $(".to-bo2-menu .is-hot", root)?.focus();
}
function editClan() {
  clanEditing = true;
  clanIn.value = getMyCard().clan;
  renderCardHost();
  clanIn.focus();
  clanIn.select();
}
clanIn.addEventListener("input", () => {
  const v = cleanClan(clanIn.value);
  if (v !== clanIn.value) clanIn.value = v;
  renderCardHost();
});
clanIn.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); stopClan(); }
});
$('[data-act="cancel"]', clanForm).addEventListener("click", stopClan);
clanForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const tag = cleanClan(clanIn.value);
  setStatus("Saving…");
  try {
    await saveMyCard({ clan: tag });
    setStatus(tag ? `Clan tag: [${tag}].` : "Clan tag removed.");
    stopClan();
    menu.refresh();
  } catch (err) {
    setStatus(`Couldn't save: ${err.message}`);
  }
});
window.addEventListener("trollforces:card-changed", () => { renderCardHost(); renderParty(); });

/* ── Reading the lobby ────────────────────────────────────────────────── */
function modeButtons(group) {
  const out = [];
  let g = null;
  for (const el of $("#to-lo-mode").children) {
    if (el.classList.contains("to-lo-modegroup")) g = text(el).toLowerCase();
    else if (g === group) out.push(el);
  }
  return out;
}
const currentModeBtn = () => $("#to-lo-mode .to-lo-modebtn.is-active");
const mapName = () => text($("#to-pf-mapcard-name")) || text($("#to-lo-maps .to-lo-map.is-active .to-map-name"));
const mapForced = () => $("#to-pf-mapcard-change")?.hidden || getComputedStyle($("#to-pf-mapcard-change")).display === "none";
const activeIn = (sel) => $$(sel).find(isOn);
const strongOf = (b) => text($("strong", b)) || text($("span", b)) || text(b);

function modeItems(group, after) {
  return modeButtons(group).map((b) => ({
    id: `mode-${b.dataset.mode}`, label: text($("span", b)), desc: b.title, on: isOn(b),
    disabled: isLocked(b), value: b.dataset.lock || "",
    onSelect: (_, m) => { b.click(); m.refresh(); if (after) after(); },
  }));
}
function ensureGroup(group, fallback) {
  const cur = currentModeBtn();
  if (!cur || !modeButtons(group).includes(cur)) $(`#to-lo-mode [data-mode="${fallback}"]`)?.click();
}
const startBtn = () => $("#to-start-btn");
/* U Mad Bro?: a Hero row under the modes while that mode is picked. */
const heroRow = () => {
  if (currentModeBtn()?.dataset.mode !== "umb") return null;
  const hb = $("#to-lo-heroes .to-lo-hero.is-active");
  return { id: "hero", label: "Hero", value: hb ? strongOf(hb) : "", go: "heroes", desc: hb?.title || "Pick who you play." };
};
const mapRow = () => ({
  id: "map", label: "Map", value: mapName(), go: mapForced() ? null : "maps",
  disabled: mapForced(), desc: mapForced() ? "This mode always plays its own map." : text($("#to-pf-mapcard-blurb")) || "Pick where you drop.",
});
// every lobby's go button is its one Primary, orange (redesign phase 4)
const deployRow = (label, desc) => ({
  id: "deploy", label, desc, tier: "primary",
  onSelect: () => { const b = startBtn(); if (b && !b.disabled) b.click(); },
});

/* Sub-screens built from one group of option buttons (attachments, gear,
   faces): pick one and go back. */
// (`valueFor`, not `valueOf`: destructuring `valueOf` off an options object
// that doesn't set it picks up Object.prototype.valueOf, and calling that
// threw, so Face never opened.)
function optionScreen(titleText, buttons, { valueFor, descOf, preview = false } = {}) {
  return {
    title: titleText,
    groups: [
      buttons.map((b, i) => ({
        id: `o-${i}`, label: strongOf(b), on: isOn(b), disabled: isLocked(b),
        value: valueFor ? valueFor(b) : "", desc: descOf ? descOf(b) : (b.title || ""), card: preview ? b : undefined,
        onSelect: (_, m) => { b.click(); m.back(); },
      })),
      [{ id: "back", label: "Back", desc: "Keep what you have.", onSelect: (_, m) => m.back() }],
    ],
  };
}

/* A perk tier: its perks (locked ones say the level), or none. */
function perkScreen(tier) {
  const L = game.loadout;
  const cur = L.classPerks[tier];
  return {
    title: PERK_TIER_NAMES[tier], panel: "loadout", detail: true, gun: true, perk: tier,
    groups: [
      perksInTier(tier).map((id) => {
        const def = PERK_DEFS[id], open = perkUnlocked(id);
        return {
          id: `pk-${id}`, perkId: id, label: def.name, on: cur === id, disabled: !open,
          value: open ? "" : `LV ${def.rank}`, desc: open ? def.blurb : `${def.blurb} Unlocks at level ${def.rank}.`,
          onSelect: (_, m) => { L.setClassPerk(tier, id); m.back(); },
        };
      }),
      [
        { id: "pk-none", label: "None", on: !cur, desc: "No perk in this slot.", onSelect: (_, m) => { L.setClassPerk(tier, null); m.back(); } },
        { id: "back", label: "Back", desc: "Keep what you have.", onSelect: (_, m) => m.back() },
      ],
    ],
  };
}

/* The whole class, in the detail pane (class-preview.js). */
const classHost = document.createElement("div");
classHost.className = "to-cp";
classHost.setAttribute("role", "group");
classHost.hidden = true;

/* The perk you're on, big, in the detail pane (BO2's perk card). */
const perkHost = document.createElement("div");
perkHost.className = "to-bo2-perk";
perkHost.hidden = true;

/* Cosmetics > Body search: a box over the list on the Body screen, by name
   or token number ("820", "#1262"), as the TROLLS bodies pile up. */
let bodyQuery = "";
const bodySearch = document.createElement("input");
bodySearch.type = "search";
bodySearch.className = "to-bo2-search";
bodySearch.placeholder = "Search bodies: name or #";
bodySearch.setAttribute("aria-label", "Search bodies");
bodySearch.autocomplete = "off";
bodySearch.spellcheck = false;
bodySearch.hidden = true;
bodySearch.addEventListener("input", () => { bodyQuery = bodySearch.value; menu.refresh(); });
bodySearch.addEventListener("keydown", (e) => {
  // Down or Enter drops into the list; Esc clears, then leaves
  if (e.key === "ArrowDown" || e.key === "Enter") { e.preventDefault(); nav.querySelector(".tr-menu-item:not([aria-disabled='true'])")?.focus(); }
  else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); if (bodySearch.value) { bodySearch.value = ""; bodyQuery = ""; menu.refresh(); } else { bodySearch.blur(); menu.back(); } }
});
const bodyMatches = (b) => {
  const q = bodyQuery.trim().toLowerCase().replace(/[#\s]+/g, "");
  return !q || text(b).toLowerCase().replace(/[#\s]+/g, "").includes(q);
};
function renderPerk(id, tier) {
  const def = PERK_DEFS[id];
  perkHost.style.setProperty("--perk", PERK_TIER_COLORS[tier]);
  perkHost.innerHTML = def
    ? `<span class="to-bo2-perk-icon">${perkIconSvg(id)}</span><div><small>${PERK_TIER_NAMES[tier]}</small><b></b><p></p>${perkUnlocked(id) ? "" : `<em>Unlocks at level ${def.rank}</em>`}</div>`
    : `<span class="to-bo2-perk-icon is-empty"></span><div><small>${PERK_TIER_NAMES[tier]}</small><b>None</b><p>No perk in this slot.</p></div>`;
  if (def) { $("b", perkHost).textContent = def.name; $("p", perkHost).textContent = def.blurb; }
}

/* ── Options rows drive the existing settings inputs ──────────────────── */
function rangeRow(id, label, step, desc, suffix = "") {
  const el = document.getElementById(id);
  if (!el) return null;
  return {
    id, label, desc, value: () => `${el.value}${suffix}`,
    adjust: (dir) => {
      const min = +el.min, max = +el.max;
      let v = +el.value + dir * step;
      if (v > max) v = dir > 0 && +el.value >= max ? min : max;
      if (v < min) v = dir < 0 && +el.value <= min ? max : min;
      el.value = String(v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    },
  };
}
function checkRow(id, label, desc) {
  const el = document.getElementById(id);
  if (!el || el.closest("[hidden]")) return null;
  return { id, label, desc, value: () => (el.checked ? "On" : "Off"), adjust: () => el.click() };
}
function selectRow(id, label, desc) {
  const el = document.getElementById(id);
  if (!el) return null;
  return {
    id, label, desc, value: () => el.options[el.selectedIndex]?.text || "",
    adjust: (dir) => {
      el.selectedIndex = (el.selectedIndex + dir + el.options.length) % el.options.length;
      el.dispatchEvent(new Event("change", { bubbles: true }));
    },
  };
}

/* ── Screens ──────────────────────────────────────────────────────────── */
let backdrop = null;
const mapMode = createMapMode({
  host: root, panelClass: "to-bo2-panel",
  getBackdrop: () => backdrop, getMenu: () => menu,
  getInset() {
    const r = nav.getBoundingClientRect();
    // Upright phones have the list on top; everywhere else it's on the left.
    return matchMedia("(max-aspect-ratio:9/10)").matches ? { top: r.bottom + 8 } : { left: r.right + 24 };
  },
});
const back = (desc = "Back.") => ({ id: "back", label: "Back", desc, onSelect: (_, m) => m.back() });
/* Empty the room code: public rooms and solo play never take one along. */
const clearRoom = () => { const r = $("#to-room"); if (r && r.value) { r.value = ""; r.dispatchEvent(new Event("input", { bubbles: true })); } };
const zombiesPicked = () => currentModeBtn()?.dataset.mode === "zombies";

const screens = {
  main: () => ({
    title: "Troll Forces", panel: "deploy", back: false,
    groups: [
      [
        { id: "public", label: "Public Match", tier: "primary", desc: "Drop into a versus room with whoever is online. Bots fill the gaps.", go: "public" },
        { id: "servers", label: "Server Browser", value: () => serverValue(), desc: "Every public server, live: who's in it and what they're playing. Pick one to join, Zombies runs too.", go: "servers" },
        { id: "social", label: "Socialize", desc: "Hang out in Troll City or at Trolling Loud with whoever is online. No guns, just emotes and chat.", go: "social" },
        { id: "solo", label: "Solo Play", desc: "Ops, Zombies or the Test Range. Just you.", go: "solo" },
        { id: "zombies", label: "Zombies", desc: "The hub: step on a map's pad, up to four of you go in together against the horde.", go: "zombies" },
        { id: "private", label: "Private Match", desc: "Make a room code and send it to your friends.", go: "private" },
      ],
      [
        { id: "class", label: "Create a Class", value: () => game.loadout?.className || "", desc: "Five classes: guns, attachments, melee, a throwable, three scorestreaks and three perks.", go: "classlist" },
        { id: "cosmetics", label: "Cosmetics", desc: "Your trollface: expression, colour and wrist.", go: "cosmetics" },
        // BO2: at the level cap the Prestige option appears.
        canPrestige() && { id: "prestige", label: "Prestige", value: nextPrestigeName(), desc: "You're at level 69. Go back to level 1 for a new prestige.", go: "prestige" },
      ].filter(Boolean),
      [
        { id: "online", label: "Who's Online", value: () => `${onlinePlayers(roster).length}`, desc: "Everyone on trollrunner.net right now, players and guests, and what they're up to.", go: "online" },
        { id: "leaders", label: "Leaderboards", desc: "This week's and this month's best trolls.", go: "leaders" },
        { id: "map", label: "Troll Map", desc: "This planet is the troll map. Spin it, find your city, see who is out there.", go: "map" },
      ],
      [
        // Options and the Barracks sit in the footer now, by the Animations
        // switch, and your name opens the Barracks (user, 2026-10-15: Options
        // was "buried in all that scrolling down").
        { id: "arcade", label: "Arcade", desc: "Back to the Troll Runner arcade.", onSelect: () => { if (!leaveToArcade()) window.location.href = "index.html?open=arcade"; } },
      ],
    ],
  }),
  /* Prestige confirm, the way BO2 asks. Only the Troll Forces level resets:
     the account level and every unlock stay. */
  prestige: () => {
    const next = Math.min(PRESTIGE_MASTER, getPrestige() + 1);
    const lv = window.TrollrunnerAccounts?.getCachedProfile?.()?.level;
    return {
      title: next >= PRESTIGE_MASTER ? "Prestige Master" : `Prestige ${next}`, panel: "deploy",
      groups: [
        [{
          id: "confirm", label: next >= PRESTIGE_MASTER ? "Become Prestige Master" : `Enter Prestige ${next}`,
          desc: `Your Troll Forces level goes back to 1. Your account stays LV ${lv ?? "?"} and everything you've unlocked stays unlocked.${next >= PRESTIGE_MASTER ? " This is the last prestige." : ""}`,
          onSelect: async (_, m) => {
            const status = $(".to-bo2-status", root);
            status.textContent = "Prestiging…";
            try {
              const p = await prestigeUp();
              status.textContent = p >= PRESTIGE_MASTER ? "You are Prestige Master." : `Welcome to Prestige ${p}.`;
              m.backTo("main");
              m.refresh();
            } catch (err) {
              status.textContent = `Couldn't prestige: ${err.message}`;
            }
          },
        }],
        [back("Not yet.")],
      ],
    };
  },
  /* Combat record (prestige phase 3, record.js): lifetime PvP numbers. The
     screen draws from the last fetch and redraws when a fresh one lands. */
  record: () => {
    const signedIn = !!window.TrollrunnerAccounts?.getCachedProfile?.();
    const r = recordView;
    const row = (id, label, value, desc) => ({ id, label, value, desc });
    let rows;
    if (!signedIn) rows = [row("r-guest", "Sign in", "", "Sign in to keep a combat record. Guests' matches aren't saved.")];
    else if (recordState === "loading" && !r) rows = [row("r-load", "Loading", "…", "Fetching your record.")];
    else if (!r) rows = [row("r-none", "No matches yet", "", "Finish a match and it lands here.")];
    else {
      const pct = (x) => `${(x * 100).toFixed(1)}%`;
      const fav = r.favourite ? `${WEAPON_DEFS[r.favourite]?.name || r.favourite} · ${r.favKills}` : "–";
      rows = [
        row("r-kd", "K/D", r.kd.toFixed(2), `${r.kills.toLocaleString()} kills, ${r.deaths.toLocaleString()} deaths.`),
        row("r-wl", "W/L", r.wl.toFixed(2), `${r.wins.toLocaleString()} wins, ${r.losses.toLocaleString()} losses.`),
        row("r-spm", "Score per minute", Math.round(r.spm).toLocaleString(), "All the score you've earned over all the time you've played."),
        row("r-acc", "Accuracy", pct(r.accuracy), `${r.shotsHit.toLocaleString()} of ${r.shotsFired.toLocaleString()} rounds hit a player. Each shotgun pellet counts.`),
        row("r-hs", "Headshots", r.headshots.toLocaleString(), r.kills ? `${pct(r.headshots / r.kills)} of your kills.` : "Kills to the head."),
        row("r-streak", "Best streak", String(r.bestStreak), "Most kills in one life."),
      ];
      rows.push(
        row("r-matches", "Matches", r.matches.toLocaleString(), "Every match you finished."),
        row("r-time", "Time played", formatPlayed(r.seconds), "In finished matches."),
        row("r-fav", "Favourite gun", fav, "The gun with the most kills."),
        row("r-assists", "Assists", r.assists.toLocaleString(), "Damage that helped someone else's kill."),
      );
    }
    return {
      title: "Combat Record", panel: "deploy",
      enter: () => loadRecord(),
      groups: [rows.slice(0, 6), rows.slice(6), [back("Back to the Barracks.")]].filter((g) => g.length),
    };
  },
  /* Barracks (prestige phase 4): your profile card in the detail pane, the
     calling card and clan tag that go on it, and the full combat record. */
  barracks: () => {
    const signedIn = !!window.TrollrunnerAccounts?.getCachedProfile?.();
    const { clan, card } = getMyCard();
    const guest = "Sign in to set it. Guests don't keep a card.";
    return {
      title: "Barracks", panel: "deploy", detail: true, card: true,
      enter: () => { clanEditing = false; previewCard = null; loadRecord(); },
      groups: [
        [
          { id: "b-card", label: "Calling Card", value: signedIn ? cardById(card).name : "", disabled: !signedIn, desc: signedIn ? "The banner behind your name." : guest, go: "cards" },
          { id: "b-clan", label: "Clan Tag", value: signedIn ? (clan ? `[${clan}]` : "None") : "", disabled: !signedIn, desc: signedIn ? "Up to 4 letters or numbers, shown as [TAG] name everywhere." : guest, onSelect: () => editClan() },
          { id: "b-rewards", label: "Prestige Rewards", desc: "What each prestige unlocks.", go: "rewards" },
          { id: "b-record", label: "Combat Record", desc: "Your lifetime K/D, W/L, accuracy and more, across every match.", go: "record" },
        ],
        [back("Back to the main menu.")],
      ],
    };
  },
  rewards: () => {
    const now = getPrestige();
    const owner = prestigeUnlocked(PRESTIGE_MASTER) && now < PRESTIGE_MASTER;   // the owner has it all
    return {
      title: "Prestige Rewards", panel: "deploy",
      groups: [
        rewardLadder().map(({ p, items }) => ({
          id: `rw-${p}`, label: p >= PRESTIGE_MASTER ? "Prestige Master" : `Prestige ${p}`,
          value: owner || now >= p ? "Unlocked" : "Locked",
          desc: items.join(" · ") + ".",
        })),
        [back("Back to the Barracks.")],
      ],
    };
  },
  cards: () => {
    const mine = getMyCard().card;
    return {
      title: "Calling Card", panel: "deploy", detail: true, card: true,
      enter: () => { previewCard = null; },
      groups: [
        CARDS.map((c) => {
          const open = cardUnlocked(c);
          const pname = c.prestige >= PRESTIGE_MASTER ? "Prestige Master" : `Prestige ${c.prestige}`;
          // Locked cards stay in the list so you can preview what's coming.
          return {
            id: `card-${c.id}`, label: c.name, cardId: c.id, on: c.id === mine,
            value: c.id === mine ? "Wearing" : open ? "" : `Locked`,
            desc: open ? c.desc : `Unlocks at ${pname}.`,
            onSelect: async (_, m) => {
              if (!open) { setStatus(`${c.name} unlocks at ${pname}.`); return; }
              if (c.id === mine) { m.back(); return; }
              setStatus("Saving…");
              try { await saveMyCard({ card: c.id }); setStatus(`Calling card: ${c.name}.`); m.back(); }
              catch (err) { setStatus(`Couldn't save: ${err.message}`); }
            },
          };
        }),
        [back("Keep this card.")],
      ],
    };
  },
  /* The public servers (menu/online.js): busiest first, then each mode's
     public room nobody is in yet. Live: the list redraws as people come and
     go. A Zombies run already on lets you in when its round ends. */
  servers: () => ({
    title: "Server Browser", panel: "deploy",
    groups: [
      serverList(roster).map((s) => {
        const n = s.players.length;
        const where = [s.mapName, s.wave ? `round ${s.wave}` : ""].filter(Boolean).join(" · ");
        return {
          id: `srv-${s.room}`, label: s.modeName, value: n ? `${n} in` : "Empty",
          desc: n ? `${where ? where + ". " : ""}${s.players.slice(0, 6).join(", ")}${n > 6 ? ` and ${n - 6} more` : ""}.${s.mode === "zombies" && s.wave ? " You spawn in when the round ends." : ""}`
            : "Nobody in yet. Start it and whoever joins plays with you.",
          onSelect: () => { if (joinServer(s)) setStatus(`Joining ${s.modeName}…`); },
        };
      }),
      [back("Back to the main menu.")],
    ],
  }),
  /* Everyone online (menu/online.js): accounts, then guests. Someone in a
     public server: select to join them; an account: their profile card. */
  online: () => {
    const me = (() => { try { return localStorage.getItem("trollrunner_viewer_id_v1"); } catch { return null; } })();
    const servers = serverList(roster);
    const rows = onlinePlayers(roster).map((p) => {
      const a = p.activity;
      const srv = a?.pub && servers.find((s) => s.room === a.room);
      return {
        id: `on-${p.key}`, label: `${p.name}${p.viewerId === me ? " (you)" : ""}`,
        value: p.guest ? "Guest" : `LV ${p.level}`,
        desc: `${describe(a)}.${srv && p.viewerId !== me ? " Select to join them." : p.viewerId === me ? "" : !p.guest ? " Select for their profile card, or invite them." : " Select to invite them."}`,
        onSelect: () => {
          if (srv && p.viewerId !== me) { if (joinServer(srv)) setStatus(`Joining ${p.name}…`); }
          else if (p.userId) openProfileCard(p.userId, { name: p.name });
          else if (p.viewerId !== me) openGuestCard({ viewerId: p.viewerId, name: p.name });
        },
      };
    });
    return { title: "Who's Online", panel: "deploy", groups: [rows, [back("Back to the main menu.")]].filter((g) => g.length) };
  },
  public: () => ({
    title: "Public Match", panel: "deploy",
    enter: () => { ensureGroup("versus", "tdm"); clearRoom(); },
    groups: [modeItems("versus"), [heroRow(), mapRow()].filter(Boolean), [deployRow("Find Match", "Join the public room for this mode."), back("Back to the main menu.")]],
  }),
  /* One public hangout room: pick a map (whoever is already there decides
     the room's map), then walk round it, chat and emote. No fighting. */
  social: () => ({
    title: "Socialize", panel: "deploy",
    enter: () => { ensureGroup("social", "social"); clearRoom(); },
    groups: [
      [{ ...mapRow(), desc: "Where you hang out. If people are already in the room, you join them on their map." }],
      [deployRow("Hang out", "Join the hangout. H for emotes, Enter to chat."), back("Back to the main menu.")],
    ],
  }),
  solo: () => ({
    title: "Solo Play", panel: "deploy",
    // a code left over from a private room would make Zombies co-op
    enter: () => { ensureGroup("solo", "ops"); clearRoom(); },
    groups: [modeItems("solo"), [mapRow()], [deployRow("Start", "Drop in."), back("Back to the main menu.")]],
  }),
  /* Zombies (Zombie Rush P5): the hub, a public room with a pad per map
     (modes/zombies/hub.js); or a room code straight into a run, the old way. */
  zombies: () => ({
    title: "Zombies", panel: "deploy",
    enter: () => { ensureGroup("hub", "zhub"); prepareHubEntry(); },
    groups: [
      [deployRow(inviteLink ? "Join your friend" : "Enter the hub", inviteLink ? "Into the hub, on your friend's private pad." : "Walk onto a map's pad. The run starts when the timer runs out or four of you are on.")],
      [
        { id: "zweapons", label: "Weapons", value: () => `${credits().toLocaleString()} Credits`, desc: "Spend Credits on guns and their levels. Your pick is your primary in every run.", onSelect: (_, m) => { openKiosk("weapons"); m.refresh(); } },
        { id: "zclasses", label: "Classes", desc: "Level up the Rookie kit: the turret, the barricade and the barrel.", onSelect: (_, m) => { openKiosk("classes"); m.refresh(); } },
      ],
      [{ id: "zcoop", label: "Room code", desc: "Skip the hub: make a room and send the code, or type a friend's.", go: "zcoop" }, back("Back to the main menu.")],
    ],
  }),
  /* Zombies with a private code (modes/zombies/coop.js): whoever has the
     code is in the run with you, up to four. Opens with a fresh code. */
  zcoop: () => ({
    title: "Zombies Co-op", panel: "deploy",
    enter: () => { $(`#to-lo-mode [data-mode="zombies"]`)?.click(); if (!$("#to-room")?.value) $("#to-newroom")?.click(); },
    groups: [
      [{ id: "room", label: "Room", value: $("#to-room")?.value || "", desc: "Your room code. Friends type it in here to join you.", go: "room" }, mapRow()],
      [deployRow("Start", "Open the room. The horde starts once everyone's in."), back("Back to the main menu.")],
    ],
  }),
  private: () => ({
    title: "Private Match", panel: "deploy",
    enter: () => ensureGroup("versus", "tdm"),
    groups: [
      modeItems("versus"),
      [heroRow(), { id: "room", label: "Room", value: $("#to-room")?.value || "Auto", desc: "Room code, bots and who's in.", go: "room" }, mapRow()].filter(Boolean),
      [deployRow("Start", "Open the room. Friends join with your code."), back("Back to the main menu.")],
    ],
  }),
  room: () => ({
    title: "Room", panel: "server", detail: true,
    groups: [
      [
        { id: "newroom", label: "New private room", value: $("#to-room")?.value || "", desc: "Makes a fresh code. Share it so friends land in your room.", onSelect: (_, m) => { $("#to-newroom")?.click(); m.refresh(); } },
        { id: "code", label: "Type a code", desc: "Join a friend's room: type their code in the box.", onSelect: () => $("#to-room")?.focus() },
        !zombiesPicked() && checkRow("to-nobots", "No bots", "Just you (and anyone with the code). Good for walking a map."),
        !zombiesPicked() && checkRow("to-botstreaks", "Bot scorestreaks", "Bots earn and call their own streaks."),
      ].filter(Boolean),
      [back(zombiesPicked() ? "Back to Zombies Co-op." : "Back to Private Match.")],
    ],
  }),
  maps: () => ({
    title: "Map", panel: "deploy", detail: true,
    groups: [
      // Socialize is the versus maps only (no prestige reward maps).
      $$("#to-lo-maps .to-lo-map").filter((b) => currentModeBtn()?.dataset.mode !== "social" || !REWARD_MAPS[b.dataset.map]).map((b) => ({
        id: `map-${b.dataset.map}`, label: text($(".to-map-name", b)), desc: text($(".to-map-tag", b)), on: isOn(b), mapId: b.dataset.map,
        // A locked prestige map stays reachable so its reason can be read.
        value: isLocked(b) ? "Locked" : "",
        onSelect: (_, m) => { if (isLocked(b)) { setStatus(text($(".to-map-tag", b))); return; } b.click(); m.back(); },
      })),
      [back("Keep this map.")],
    ],
  }),
  /* BO2's Create a Class: five classes; the ticked one is what you drop in
     with. Picking one makes it yours and opens it. */
  classlist: () => {
    const L = game.loadout;
    return {
      title: "Create a Class", panel: "loadout", detail: true, gun: true, cls: L.active,
      groups: [
        L.classes.map((c, i) => ({
          id: `cl-${i}`, label: c.name, on: i === L.active, desc: L.classSummary(i), classIdx: i,
          onSelect: (_, m) => { L.setActiveClass(i); m.go("class"); },
        })),
        [back("Back to the main menu.")],
      ],
    };
  },
  class: () => {
    const L = game.loadout;
    const slot = (s) => { $(`#to-lo-slot-toggle [data-slot="${s}"]`)?.click(); return strongOf(activeIn("#to-lo-list .to-lo-weapon") || document.createElement("b")); };
    const primary = text($("#to-pf-sum-name"));
    const secondary = text($("#to-pf-sum-secondary"));
    const gearRow = (i) => $$("#to-lo-gear .to-lo-gearrow")[i];
    const gearVal = (i) => { const cur = gearRow(i) && $$(".to-lo-gear", gearRow(i)).find(isOn); return cur ? strongOf(cur) : ""; };
    const streaks = [...L.classStreaks].filter((id) => STREAK_DEFS[id]).map((id) => STREAK_DEFS[id].short || STREAK_DEFS[id].name);
    return {
      title: L.className, panel: "loadout", detail: true, gun: true, cls: L.active,
      groups: [
        [
          { id: "primary", label: "Primary", value: primary, desc: "Your main weapon.", onSelect: (_, m) => { slot("primary"); m.go("classes"); } },
          { id: "secondary", label: "Secondary", value: secondary, desc: "Your sidearm.", onSelect: (_, m) => { slot("secondary"); m.go("weapons"); } },
          { id: "atts", label: "Attachments", value: $$("#to-pf-sum-atts > *").length ? `${$$("#to-pf-sum-atts > *").length} on` : "", desc: "Optic, barrel, underbarrel, ammo and skin for your primary.", onSelect: (_, m) => { $('#to-lo-slot-toggle [data-slot="primary"]')?.click(); m.go("atts"); } },
          { id: "melee", label: "Melee", value: gearVal(0), desc: "What you swing.", go: "gear-0" },
          { id: "throwable", label: "Throwable", value: gearVal(1), desc: "The one lethal or tactical you carry.", go: "gear-1" },
        ],
        [0, 1, 2].map((t) => {
          const id = L.classPerks[t];
          return { id: `perk-${t}`, label: PERK_TIER_NAMES[t], value: PERK_DEFS[id]?.short || PERK_DEFS[id]?.name || "None", desc: PERK_DEFS[id]?.blurb || "Pick a perk.", go: `perk-${t}` };
        }),
        [
          { id: "streaks", label: "Scorestreaks", value: streaks.length ? `${streaks.length}/3` : "", desc: streaks.join(" · ") || "Pick three. Kills, assists and objectives build the meter.", go: "streaks" },
          { id: "rename", label: "Rename", value: L.className, desc: "Up to 16 letters. Enter saves, Esc cancels.", onSelect: () => renameClass() },
        ],
        [back("Back to your classes.")],
      ],
    };
  },
  classes: () => ({
    title: "Primary", panel: "loadout", detail: true, gun: true,
    groups: [
      $$("#to-lo-classes .to-lo-class").map((b) => ({
        id: `cls-${b.dataset.cls}`, label: text(b), on: isOn(b), desc: `Pick a weapon from ${text(b).toLowerCase()}.`,
        onSelect: (_, m) => { b.click(); m.go("weapons"); },
      })),
      [back("Back to the class.")],
    ],
  }),
  weapons: () => ({
    title: text(activeIn("#to-lo-classes .to-lo-class")) || "Weapons", panel: "loadout", detail: true, gun: true,
    groups: [
      $$("#to-lo-list .to-lo-weapon").map((b, i) => {
        const sub = text($("span", b));
        const lv = sub.match(/level (\d+)/i);
        return {
          id: `w-${i}`, label: strongOf(b), on: isOn(b), disabled: isLocked(b), card: b,
          value: lv ? `LV ${lv[1]}` : sub, desc: lv ? `Unlocks at level ${lv[1]}.` : sub,
          onSelect: (_, m) => { b.click(); m.backTo("class"); },
        };
      }),
      [back("Back.")],
    ],
  }),
  atts: () => ({
    title: "Attachments", panel: "customize", detail: true, gun: true,
    groups: [
      $$("#to-lo-atts .to-lo-slot").map((slotEl, i) => {
        const cur = $$(".to-lo-att, button", slotEl).find(isOn);
        return { id: `slot-${i}`, label: text($(".to-lo-slot-label", slotEl)), value: cur ? strongOf(cur) : "", desc: "Change it.", go: `att-${i}` };
      }),
      [back("Back to the class.")],
    ],
  }),
  gear: () => ({
    title: "Gear", panel: "gear", detail: true, gun: true,
    groups: [
      $$("#to-lo-gear .to-lo-gearrow").map((row, i) => {
        const cur = $$(".to-lo-gear", row).find(isOn);
        return { id: `gearrow-${i}`, label: text($(".to-lo-slot-label", row)), value: cur ? strongOf(cur) : "", desc: cur?.title || "", go: `gear-${i}` };
      }),
      [back("Back to the main menu.")],
    ],
  }),
  streaks: () => {
    const cards = $$("#to-ss-picker .to-ss-card");
    const picked = cards.filter(isOn).length;
    return {
      title: `Scorestreaks ${picked}/3`, panel: "streaks", detail: true, gun: true,
      groups: [
        cards.map((b, i) => ({
          id: `ss-${i}`, label: strongOf(b), on: isOn(b), disabled: isLocked(b), card: b,
          value: text($("span", b)), desc: text($("em", b)),
          onSelect: (_, m) => { b.click(); m.refresh(); },
        })),
        [back("Back to the class.")],
      ],
    };
  },
  cosmetics: () => {
    const face = $$("#to-cos-body .to-cos-face:not([data-wrist]):not([data-body])").find(isOn);
    const wrist = $$("#to-cos-body [data-wrist]").find(isOn);
    const body = $$("#to-cos-body [data-body]").find(isOn);
    return {
      title: "Cosmetics", panel: "cosmetics",
      groups: [
        [
          { id: "body", label: "Body", value: body ? text($("span:last-child", body)) : "", desc: "Wear a TROLLS NFT's look. Holders only.", go: "bodies" },
          { id: "face", label: "Face", value: face ? text($("span:last-child", face)) : body?.dataset.body ? "The NFT's own" : "", desc: body?.dataset.body ? "A TROLLS body wears its own head: no expression or face covering with it." : "Your trollface's expression. Everyone in the match sees it.", go: "faces" },
          { id: "wrist", label: "Wrist", value: wrist ? text($("span:last-child", wrist)) : "", desc: "Something on your left wrist. Everyone sees it, and so do you, in your own hands.", go: "wrists" },
        ],
        [back("Back to the main menu.")],
      ],
    };
  },
  heroes: () => optionScreen("Hero", $$("#to-lo-heroes .to-lo-hero")),
  bodies: () => {
    const s = optionScreen("Body", $$("#to-cos-body [data-body]").filter(bodyMatches), {
      descOf: (b) => (isLocked(b) ? "Locked: for the holder of this TROLLS NFT." : b.dataset.body ? "This TROLLS look, every match. Everyone sees it." : "The classic stick troll."),
    });
    s.enter = () => { bodyQuery = bodySearch.value = ""; };
    if (!s.groups[0].length) s.groups[0] = [{ id: "o-none", label: "No match", disabled: true, desc: `No TROLLS body matches "${bodyQuery.trim()}".` }];
    return s;
  },
  faces: () => optionScreen("Face", $("#to-cos-body .to-cos-face:not([data-wrist]):not([data-body])"), { descOf: (b) => (isLocked(b) ? "Off while you wear a TROLLS body: it has its own head." : "Everyone in the match sees it.") }),
  wrists: () => optionScreen("Wrist", $$("#to-cos-body [data-wrist]"), { descOf: (b) => (b.dataset.wrist ? "On your left wrist, every match." : "A bare wrist.") }),
  leaders: () => ({
    title: "Leaderboards", panel: "deploy", detail: true, lb: true,
    groups: [[
      { id: "period", label: "Board", value: lbProvider.period === "month" ? "Monthly" : "Weekly", desc: "Weekly resets every Monday, monthly on the 1st. Your all-time stats are on your profile card.",
        onSelect: (_, m) => { lbProvider.setPeriod(lbProvider.period === "month" ? "week" : "month"); window.TrollLeaderboard?.refresh?.("troll-ops"); m.refresh(); } },
      back("Back to the main menu."),
    ]],
  }),
  options: () => ({
    title: "Options", panel: "controls", detail: true,
    groups: [
      [
        rangeRow("to-set-volume-lobby", "Master volume", 10, "How loud everything is."),
        rangeRow("to-set-ambience-lobby", "Ambience", 10, "Each map's background sound. Goes quiet while the radio is playing."),
        rangeRow("to-set-sens-lobby", "Look sensitivity", 10, "Mouse and touch look speed."),
        selectRow("to-set-padsens-lobby", "Stick sensitivity", "Controller look speed. 3 is the BO2 default."),
        rangeRow("to-set-fov-lobby", "Field of view", 2, "Wider sees more, narrower zooms in."),
        selectRow("to-set-gfx-lobby", "Graphics", "Auto picks for your device."),
      ].filter(Boolean),
      [
        checkRow("to-set-invert-lobby", "Invert look", "Flip up and down."),
        checkRow("to-set-minimap-lobby", "Minimap", "The radar in the corner."),
        checkRow("to-set-fps-lobby", "Show FPS", "Frame rate in the top corner."),
        selectRow("to-set-botskill", "Bot skill", "Veteran bots give +10% XP."),
        checkRow("to-set-viewmode-lobby", "View mode", "Just look at the maps, no fighting."),
      ].filter(Boolean),
      [
        { id: "anim", label: "Animations", value: () => (animOff ? "Off" : "On"), adjust: () => toggleAnim(),
          desc: "The spinning planet and the asteroids. Off is easier on a slow laptop." },
        { id: "hud", label: "HUD layout", desc: "Move the buttons and the HUD.", onSelect: () => $("#to-pfp-controls [data-hud-layout]")?.click() },
        back("Back to the main menu."),
      ],
    ],
  }),
  ...mapMode.screens,
};
// Dynamic option sub-screens (att-0.., gear-0..) resolve from the live DOM.
const optionScreens = new Proxy(screens, {
  get(t, id) {
    if (id in t) return t[id];
    const a = /^att-(\d+)$/.exec(id), g = /^gear-(\d+)$/.exec(id), p = /^perk-([012])$/.exec(id);
    if (p) return () => perkScreen(+p[1]);
    if (a) {
      const slotEl = $$("#to-lo-atts .to-lo-slot")[+a[1]];
      if (slotEl) return () => optionScreen(text($(".to-lo-slot-label", slotEl)), $$(".to-lo-att, button", slotEl), {
        descOf: (b) => text($("small", b)) || b.title,
        valueFor: (b) => $$(".to-att-delta b", b).map(text).join(" "),
      });
    }
    if (g) {
      const row = $$("#to-lo-gear .to-lo-gearrow")[+g[1]];
      if (row) return () => optionScreen(text($(".to-lo-slot-label", row)), $$(".to-lo-gear", row), { valueFor: (b) => text($("span", b)), preview: true });
    }
    return undefined;
  },
  has(t, id) { return id in t || /^(att|gear|perk)-\d+$/.test(id); },
});

/* U Mad Bro? teaser: while its mode row is hot (locked or not), the detail
   pane shows the hero banners, the two album-cover parodies taking turns.
   onHot fires before onScreen on a re-render, so onScreen re-applies it. */
const UMB_BANNERS = ["umb-agents", "umb-highway"].map((n) => `assets/games/troll-ops/ui/${n}.jpg?v=umb1`);
let lastHot = null, previewing = false, screenDetail = false, umbTimer = 0, umbIdx = 0;
function umbBanner(it) {
  const on = it?.id === "mode-umb";
  const img = $("img", shot);
  if (on) {
    root.classList.add("has-detail", "is-umb");
    shot.hidden = false;
    img.hidden = false;
    img.alt = "U Mad Bro? heroes: Troll Knight, Troll Hunter, Super Troll, Troll Metamorphosis and the Trollernaut";
    img.src = UMB_BANNERS[umbIdx];
    $("figcaption", shot).textContent = it.desc || "";
    if (!umbTimer) umbTimer = setInterval(() => { umbIdx = (umbIdx + 1) % UMB_BANNERS.length; img.src = UMB_BANNERS[umbIdx]; }, 4500);
  } else if (root.classList.contains("is-umb")) {
    clearInterval(umbTimer); umbTimer = 0;
    root.classList.remove("is-umb");
    root.classList.toggle("has-detail", screenDetail);
    shot.hidden = lastScreen !== "maps";
    img.alt = "";
  }
}

/* ── The menu ─────────────────────────────────────────────────────────── */
let lastPanel = null, lastScreen = null;
const menu = createBo2Menu(nav, {
  screens: optionScreens, keys: true,
  onScreen(id, s, m) {
    // A screen's enter() runs once on arrival (e.g. pick a versus mode for
    // Public Match), then the screen re-renders from the updated lobby.
    if (id !== lastScreen) { lastScreen = id; if (s.enter) { s.enter(); m.refresh(); return; } }
    if (s.panel && s.panel !== lastPanel) { lastPanel = s.panel; rail(s.panel); }
    root.dataset.screen = id;
    // the dock (Emote, Chat, Barracks, Options) is the top menu's only:
    // inside a screen the footer is Back, nothing else to press
    root.classList.toggle("is-top", id === "main");
    // Phones size the operator and the detail pane from the list's height.
    pf.style.setProperty("--menu-h", `${nav.offsetHeight}px`);
    screenDetail = !!s.detail || id === "search" || id === "pinsearch";
    root.classList.toggle("has-detail", screenDetail);
    root.classList.toggle("has-gun", !!s.gun);
    root.classList.toggle("has-lb", !!s.lb);
    lbHost.hidden = !s.lb;
    if (s.lb && !lbHost.dataset.mounted) {
      lbHost.dataset.mounted = "1"; lbHost.id = "to-bo2-lb";
      // weekly or monthly, added up from the filed matches (leaderboard-rows.js)
      window.TrollLeaderboard?.setProvider?.("troll-ops", lbProvider);
      window.TrollLeaderboard?.mount?.("troll-ops", "#to-bo2-lb");
    }
    shot.hidden = id !== "maps";
    if (id !== "barracks") clanEditing = false;
    cardHost.hidden = !s.card;
    root.classList.toggle("has-card", !!s.card);
    perkHost.hidden = s.perk == null;
    if (!bodySearch.isConnected) nav.insertBefore(bodySearch, $(".tr-menu-groups", nav));
    bodySearch.hidden = id !== "bodies";
    root.classList.toggle("has-perk", s.perk != null);
    if (s.perk != null) renderPerk(game.loadout.classPerks[s.perk], s.perk);
    classHost.hidden = s.cls == null;
    root.classList.toggle("has-cls", s.cls != null);
    if (s.cls != null) renderClassPreview(classHost, game.loadout, lastHot?.classIdx ?? s.cls);
    renderCardHost();
    const ownBack = (s.groups || []).flat().some((it) => it && it.id === "back");
    $(".to-bo2-back", root).classList.toggle("is-on", m.depth() > 0 && !ownBack);
    mapMode.onScreen(id, s);
    umbBanner(lastHot);
  },
  onHot(it) {
    lastHot = it;
    umbBanner(it);
    // Calling cards: the card you're on shows on your profile card.
    if (lastScreen === "cards") { previewCard = it?.cardId || null; renderCardHost(); }
    // A perk tier: the perk you're on (None shows the slot empty).
    const pt = /^perk-(\d)$/.exec(lastScreen || "");
    if (pt && it && (it.perkId || it.id === "pk-none")) renderPerk(it.perkId || null, +pt[1]);
    // Create a Class: the class you're on, all of it (class-preview.js).
    if (lastScreen === "classlist" && it?.classIdx != null) renderClassPreview(classHost, game.loadout, it.classIdx);
    if (!it) return;
    if (it.mapId) {
      const img = $("img", shot);
      setMapShot(img, it.mapId, `${Math.ceil(shot.parentElement?.clientWidth || 640)}px`);
      $("figcaption", shot).textContent = it.desc || "";
    }
    // Previews: the old picker cards (streaks, weapons, melee, throwables)
    // show their model on focus; off them, the preview goes back to your pick.
    if (it.card) { it.card.dispatchEvent(new MouseEvent("mouseenter")); it.card.dispatchEvent(new FocusEvent("focus")); previewing = true; }
    else if (previewing) { previewing = false; window.dispatchEvent(new Event("trollforces:preview-end")); }
  },
});
$(".to-bo2-back", root).addEventListener("click", () => menu.back());
initExitLinks();

/* Rename a class: a one-line form over the detail pane, like the clan tag. */
const renameForm = document.createElement("form");
renameForm.className = "to-bo2-clan to-bo2-rename";
renameForm.hidden = true;
renameForm.innerHTML = `<label for="to-bo2-rename-in">Class name</label>`
  + `<input id="to-bo2-rename-in" maxlength="16" autocomplete="off" spellcheck="false" aria-describedby="to-bo2-rename-help">`
  + `<button type="submit">Save</button><button type="button" data-act="cancel">Cancel</button>`
  + `<small id="to-bo2-rename-help">Up to 16 letters. Enter saves, Esc cancels.</small>`;
detail.prepend(renameForm);
detail.prepend(perkHost);
detail.prepend(classHost);
const renameIn = $("input", renameForm);
function stopRename() {
  renameForm.hidden = true;
  $(".to-bo2-menu .is-hot", root)?.focus();
}
function renameClass() {
  renameIn.value = game.loadout.className;
  renameForm.hidden = false;
  renameIn.focus();
  renameIn.select();
}
renameIn.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); stopRename(); }
});
$('[data-act="cancel"]', renameForm).addEventListener("click", stopRename);
renameForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const L = game.loadout;
  if (L.renameClass(L.active, renameIn.value)) { setStatus(`Class renamed: ${L.className}.`); L.render(); }
  stopRename();
  menu.refresh();
});

/* ── Party, status, presence ──────────────────────────────────────────── */
/* Everyone else online right now (the presence roster, accounts first,
   then guests), under your own row: the user, 2026-10-15: "when users are
   online i should be able to see them where i see the whole 1 Player (8
   max) ... when there are users who are not online then they dont show up
   there". Presence drops a closed tab on its next sync, so this list is
   only ever who's on. Up to 7 beside you (8 in all); past that, a line
   opens Who's Online. */
const PARTY_MAX = 8;
const partyList = document.createElement("div");
partyList.className = "to-bo2-party-others";
partyList.setAttribute("role", "list");
partyList.setAttribute("aria-label", "Online now");
$(".to-bo2-xp", root).after(partyList);
function renderPartyOthers() {
  const myViewer = viewerId(), uid = myUid();
  const others = onlinePlayers(roster).filter((o) => o.viewerId !== myViewer && !(uid && o.userId === uid));
  const shown = others.slice(0, PARTY_MAX - 1);
  partyList.replaceChildren(...shown.map((o) => {
    const item = document.createElement("div");
    item.className = "to-bo2-party-item";
    item.setAttribute("role", "listitem");
    const row = document.createElement("button");
    row.className = "to-bo2-party-row is-other";
    const lv = document.createElement("i");
    lv.className = "to-bo2-lv";
    lv.textContent = o.guest ? "Guest" : `LV ${o.level}`;
    const name = document.createElement("b");
    name.className = "to-bo2-name";
    name.textContent = o.name;
    const doing = document.createElement("small");
    doing.textContent = describe(o.activity);
    row.append(lv, name, doing);
    row.type = "button";
    if (o.userId) {
      row.title = `${o.name}: profile card and invite`;
      row.addEventListener("click", () => openProfileCard(o.userId, { name: o.name }));
    } else {
      row.title = `${o.name}: invite them to play`;
      row.addEventListener("click", () => openGuestCard({ viewerId: o.viewerId, name: o.name }));
    }
    // Invite straight from the list (the redesign's social column)
    const inv = document.createElement("button");
    inv.type = "button";
    inv.className = "tf-btn tf-btn--secondary to-bo2-party-invite";
    inv.textContent = "Invite";
    inv.setAttribute("aria-label", `Invite ${o.name} to play`);
    inv.addEventListener("click", () => {
      const msg = invitePlayer({ viewerId: o.viewerId, name: o.name, userId: o.userId });
      inv.title = msg || "";
      if (/^Invite sent/.test(msg || "")) { inv.textContent = "Sent"; inv.disabled = true; }
    });
    item.append(row, inv);
    return item;
  }));
  const more = document.createElement("button");
  more.type = "button";
  more.className = "to-bo2-party-more";
  more.addEventListener("click", () => menu.go("online"));
  const setMore = () => {
    const n = others.length - (partyList.children.length - (more.parentNode ? 1 : 0));
    more.textContent = `+${n} more online`;
    if (n > 0 && !more.parentNode) partyList.appendChild(more);
  };
  setMore();
  fitPartyList(setMore);
  return 1 + shown.length;
}
/* On a small screen the list stops short of the controls below it (the
   online count, the Animations switch, the Emote button: user's rule, no
   overlapping UI text); the rows that don't fit fold into "+N more". */
const PARTY_BELOW = [".to-bo2-online", ".to-bo2-foot .to-bo2-quick", "#to-char-emote", ".to-bo2-chatcard"];
function fitPartyList(setMore) {
  const list = partyList.getBoundingClientRect();
  if (!list.height) return;
  let limit = innerHeight - 6;
  for (const sel of PARTY_BELOW) {
    const el = document.querySelector(sel);
    const r = el?.offsetParent ? el.getBoundingClientRect() : null;
    if (r && r.width && r.left < list.right && r.right > list.left && r.top > list.top) limit = Math.min(limit, r.top - 6);
  }
  const rows = () => [...partyList.querySelectorAll(".to-bo2-party-row")];
  while (rows().length && partyList.lastElementChild.getBoundingClientRect().bottom > limit) {
    const last = rows().pop();
    (last.closest(".to-bo2-party-item") || last).remove();
    setMore();
  }
}
addEventListener("resize", () => renderParty());
function renderParty() {
  const p = window.TrollrunnerAccounts?.getCachedProfile?.();
  const n = renderPartyOthers();
  $(".to-bo2-party-lbl", root).innerHTML = `${n} Player${n > 1 ? "s" : ""} <span>(${PARTY_MAX} Max)</span>`;
  $(".to-bo2-name", root).textContent = p?.username ? withClan(p.username, getMyCard().clan) : "Guest troll";
  const rankEl = $("#to-lo-rank-label"), owner = !!rankEl?.classList.contains("is-owner");
  const lv = $(".to-bo2-lv", root);
  lv.textContent = owner ? "Owner" : (text(rankEl) || "Level 1").replace(/Level/i, "LV");
  // the rank or prestige icon in front, as in the loadout strip
  const icon = !owner && rankEl?.querySelector("svg");
  if (icon) lv.prepend(icon.cloneNode(true));
  lv.classList.toggle("has-rank-icon", !!icon);
  lv.classList.toggle("is-owner", owner);   // the owner badge, no level (style.css)
  const xp = $(".to-bo2-xp", root);
  xp.textContent = p ? text($("#to-pf-xp")) : "Log in to keep your XP";
  xp.hidden = !xp.textContent;
}
// Your name: the Barracks (your card, calling card, clan tag, record) when
// signed in, the sign-in when not.
$(".to-bo2-party-row", root).title = "Your Barracks";
$(".to-bo2-party-row", root).addEventListener("click", () => {
  if (myUid()) openQuick("barracks");
  else $("#to-pf-profile")?.click();
});
// The footer's Barracks and Options buttons: straight there from anywhere
// in the menu, Back returns to the main menu.
function openQuick(id) {
  if (menu.current() === id) return;
  menu.backTo("main");
  menu.go(id);
}
for (const b of $$(".to-bo2-quick[data-go]", root)) b.addEventListener("click", () => openQuick(b.dataset.go));
/* The Emote pill joins that row (user, 2026-10-15: under the operator's
   feet it sat on the footer buttons). It still shows only while the
   operator does (lobby.js charInspectorLive hides .to-char-view). */
{
  const emoteBtn = document.getElementById("to-char-emote");
  const charView = document.querySelector(".to-char-view");
  if (emoteBtn) {
    $(".to-bo2-foot .to-bo2-quick", root).before(emoteBtn);
    const sync = () => { emoteBtn.hidden = !!charView && charView.style.display === "none"; };
    sync();
    if (charView) new MutationObserver(sync).observe(charView, { attributes: true, attributeFilter: ["style"] });
  }
}
// The footer grows (Back button, status line), so the list's room comes
// from its real height: see .to-bo2-menu in style.css.
{
  const foot = $(".to-bo2-foot", root);
  const setFoot = () => root.style.setProperty("--foot-h", `${foot.offsetHeight}px`);
  setFoot();
  new ResizeObserver(setFoot).observe(foot);
}
window.addEventListener("trollrunner:auth-changed", () => setTimeout(() => { renderParty(); menu.refresh(); }, 50));
window.addEventListener("trollforces:prestige-changed", () => setTimeout(() => { renderParty(); menu.refresh(); }, 50));
for (const el of [$("#to-lo-rank-label"), $("#to-pf-roster")]) if (el) new MutationObserver(renderParty).observe(el, { childList: true, characterData: true, subtree: true });
renderParty();

// Deploy feedback (connecting, room full...) shows under the online count.
const net = $("#to-net-status");
let netBase = text(net);
if (net) new MutationObserver(() => { const t = text(net); $(".to-bo2-status", root).textContent = t !== netBase ? t : ""; }).observe(net, { childList: true, characterData: true, subtree: true });

/* Who's online and the servers (menu/online.js): the presence roster, kept
   current; the two screens and the main menu's counts redraw with it. */
function serverValue() {
  const n = serverList(roster).filter((s) => s.players.length).length;
  return n ? `${n} live` : "";
}
const presence = joinSitePresence({
  onCount: (n) => { $(".to-bo2-online", root).textContent = `${n} Online`; },
  onSync: (r) => {
    roster = r;
    renderParty();
    if (["servers", "online", "main"].includes(menu.current()) && !title.hidden) menu.refresh();
  },
});
roster = presence.roster();
startOnline(presence);
// Invites (menu/invites.js) on the same channel, the cards' Invite button
initInvites(presence);
setInviteHandler(invitePlayer);
// The public chat (menu/public-chat.js): its pill in the footer, for
// everyone, guests too; it opens while the menu's up
initPublicChat({ presence, pill: $(".to-bo2-chat", root), viewerId, canOpen: () => !title.hidden, matchChat: () => game.chat });
setChatPreview($(".to-bo2-chatcard-log", root));
// The count opens the list.
{
  const online = $(".to-bo2-online", root);
  online.setAttribute("role", "button");
  online.tabIndex = 0;
  online.title = "Who's online";
  online.addEventListener("click", () => menu.go("online"));
  online.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); menu.go("online"); } });
}

/* ── Map preloading (map-preload.js): a quiet line under the online count ─ */
const dl = $(".to-bo2-dl", root);
function renderDl() {
  const P = window.__trollPreload;
  if (!P) return;
  const id = P.current;
  if (id) {
    const st = P.status(id);
    dl.classList.add("is-on");
    dl.classList.toggle("is-done", false);
    $("b", dl).textContent = `${st.state === "compiling" ? "Warming" : "Loading"} ${P.names[id] || id} ${Math.round(st.progress * 100)}%`;
    $("i", dl).style.setProperty("--p", st.progress);
  } else {
    // Quiet once nothing is moving; it says so briefly when a batch ends.
    const n = P.readyCount();
    dl.classList.toggle("is-on", n > 0 && dl.classList.contains("is-on"));
    dl.classList.add("is-done");
    $("b", dl).textContent = "Maps ready";
    $("i", dl).style.setProperty("--p", n / P.ids.length);
  }
}
let dlHide = 0;
(function hookPreload() {
  const P = window.__trollPreload;
  if (!P) { setTimeout(hookPreload, 250); return; }
  P.onChange(() => {
    renderDl();
    clearTimeout(dlHide);
    if (!P.current) dlHide = setTimeout(() => dl.classList.remove("is-on"), 2500);
  });
  renderDl();
})();

/* ── Animations (an Options row; it was a footer switch till the redesign,
   user 2026-10-16) ───────────────────────────────────────────────────────
   For slow laptops (user, 2026-10-03): off freezes the planet and the
   asteroids, drops the menu's CSS animations (body.tf-anim-off), and
   game.js cuts the solo pre-match countdown short. Remembered per device. */
const ANIM_KEY = "tf-anim-off";
let animOff = false;
try { animOff = localStorage.getItem(ANIM_KEY) === "1"; } catch {}
function applyAnim() {
  document.body.classList.toggle("tf-anim-off", animOff);
  backdrop?.setStill?.(animOff);
}
function toggleAnim() {
  animOff = !animOff;
  try { animOff ? localStorage.setItem(ANIM_KEY, "1") : localStorage.removeItem(ANIM_KEY); } catch {}
  applyAnim();
}
applyAnim();

/* ── The planet: lazy, and paused whenever the lobby isn't showing ───── */
const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 300));
function coverOn(on) { document.body.classList.toggle("to-bo2-cover", on); }
idle(async () => {
  try {
    const { mountMenuBackdrop } = await import("../../../js/menu-globe.js?v=to-bo2g");
    backdrop = mountMenuBackdrop($(".to-bo2-bg", root));
    if (animOff) backdrop.setStill?.(true);
    coverOn(!title.hidden);
    if (title.hidden) backdrop.pause();
  } catch (e) { console.warn("[menu-bo2] backdrop", e); }
});
new MutationObserver(() => {
  const showing = !title.hidden;
  if (!showing) $(".tr-pincard", root)?.setAttribute("hidden", "");
  if (backdrop) { showing ? backdrop.resume() : backdrop.pause(); coverOn(showing); }
  if (showing) { renderParty(); menu.refresh(); }
}).observe(title, { attributes: true, attributeFilter: ["hidden"] });
document.addEventListener("visibilitychange", () => {
  if (!backdrop || title.hidden) return;
  document.hidden ? backdrop.pause() : backdrop.resume();
});

// An invite link (?zhub=ROOM&party=CODE): open on Zombies, ready to go.
if (inviteLink) menu.go("zombies");

window.__toBo2 = { menu, get backdrop() { return backdrop; } };   // for headless tests
