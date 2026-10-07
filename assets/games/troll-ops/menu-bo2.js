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

import { createBo2Menu } from "../../js/bo2-menu.js?v=to-ft2";
import { createMapMode } from "../../js/troll-map-mode.js?v=to-bo2d";
import { joinSitePresence } from "../../js/site-presence.js?v=to-bo2d";
import { canPrestige, prestigeUp, getPrestige, prestigeUnlocked, PRESTIGE_MASTER } from "./progression.js?v=p5-wst-sb2-fu1";

import { fetchRecord, formatPlayed } from "./record.js?v=rec1";
import { WEAPON_DEFS } from "./weapons.js?v=p5bm-wst-hf1-fu1";
import { CARDS, cardById, cardUnlocked, getMyCard, saveMyCard, cleanClan, withClan } from "./calling-cards.js?v=p5-wst-sb2-fu1";
import { renderCard, myCardData, openProfileCard } from "./profile-card.js?v=pc1-wst-sb2-fu1";
import { shareCardOnX, saveCardPhoto } from "./menu/card-share.js?v=cs1";
import { FINISHES } from "./skins.js?v=p5";
import { MAPS, REWARD_MAPS } from "./maps.js?v=p5tc-k9-em1-wst-tl1-bs1-tl2-sb1-rp1-dj1-cr1-db1-sb2-db2a-db2b-db2c-db3-db4-db5-gj1-fu1";
import { setMapShot } from "./map-load-screen.js?v=ml3-wst-tl1-ng1-db5-gj1-fu1";

/* Everything prestige unlocks, by prestige (prestige phase 5): finishes,
   calling cards, the gold gun and the private-match maps. */
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
    <button type="button" class="to-bo2-anim" role="switch" aria-checked="true">Animations <b>On</b></button>
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
const deployRow = (label, desc) => ({
  id: "deploy", label, desc,
  onSelect: () => { const b = startBtn(); if (b && !b.disabled) b.click(); },
});

/* Sub-screens built from one group of option buttons (attachments, gear,
   faces): pick one and go back. */
// (`valueFor`, not `valueOf`: destructuring `valueOf` off an options object
// that doesn't set it picks up Object.prototype.valueOf, and calling that
// threw, so Face and Face colour never opened.)
function optionScreen(titleText, buttons, { valueFor, descOf } = {}) {
  return {
    title: titleText,
    groups: [
      buttons.map((b, i) => ({
        id: `o-${i}`, label: strongOf(b), on: isOn(b), disabled: isLocked(b),
        value: valueFor ? valueFor(b) : "", desc: descOf ? descOf(b) : (b.title || ""),
        onSelect: (_, m) => { b.click(); m.back(); },
      })),
      [{ id: "back", label: "Back", desc: "Keep what you have.", onSelect: (_, m) => m.back() }],
    ],
  };
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
    return matchMedia("(max-width:760px)").matches ? { bottom: Math.max(0, innerHeight - r.top + 8) } : { left: r.right + 24 };
  },
});
const back = (desc = "Back.") => ({ id: "back", label: "Back", desc, onSelect: (_, m) => m.back() });

const screens = {
  main: () => ({
    title: "Troll Forces", panel: "deploy", back: false,
    groups: [
      [
        { id: "public", label: "Public Match", desc: "Drop into a versus room with whoever is online. Bots fill the gaps.", go: "public" },
        { id: "social", label: "Socialize", desc: "Hang out on any map with whoever is online. No guns, just emotes and chat.", go: "social" },
        { id: "solo", label: "Solo Play", desc: "Ops, Zombies or the Test Range. Just you.", go: "solo" },
        { id: "private", label: "Private Match", desc: "Make a room code and send it to your friends.", go: "private" },
      ],
      [
        { id: "class", label: "Create a Class", desc: "Primary, secondary and every attachment.", go: "class" },
        { id: "gear", label: "Gear", desc: "Melee and the one throwable you carry.", go: "gear" },
        { id: "streaks", label: "Scorestreaks", desc: "Pick three. Kills, assists and objectives build the meter.", go: "streaks" },
        { id: "cosmetics", label: "Cosmetics", desc: "Your trollface: expression, colour and wrist.", go: "cosmetics" },
        // BO2: at the level cap the Prestige option appears.
        canPrestige() && { id: "prestige", label: "Prestige", value: nextPrestigeName(), desc: "You're at level 69. Go back to level 1 for a new prestige.", go: "prestige" },
      ].filter(Boolean),
      [
        { id: "leaders", label: "Leaderboards", desc: "This week's best trolls.", go: "leaders" },
        { id: "barracks", label: "Barracks", desc: "Your profile card: calling card, clan tag and combat record.", go: "barracks" },
        { id: "map", label: "Troll Map", desc: "This planet is the troll map. Spin it, find your city, see who is out there.", go: "map" },
      ],
      [
        { id: "options", label: "Options", desc: "Sensitivity, FOV, graphics, controls and the HUD.", go: "options" },
        { id: "arcade", label: "Arcade", desc: "Back to the Troll Runner arcade.", href: "games.html" },
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
  public: () => ({
    title: "Public Match", panel: "deploy",
    enter: () => { ensureGroup("versus", "tdm"); const r = $("#to-room"); if (r && r.value) { r.value = ""; r.dispatchEvent(new Event("input", { bubbles: true })); } },
    groups: [modeItems("versus"), [heroRow(), mapRow()].filter(Boolean), [deployRow("Find Match", "Join the public room for this mode."), back("Back to the main menu.")]],
  }),
  /* One public hangout room: pick a map (whoever is already there decides
     the room's map), then walk round it, chat and emote. No fighting. */
  social: () => ({
    title: "Socialize", panel: "deploy",
    enter: () => { ensureGroup("social", "social"); const r = $("#to-room"); if (r && r.value) { r.value = ""; r.dispatchEvent(new Event("input", { bubbles: true })); } },
    groups: [
      [{ ...mapRow(), desc: "Where you hang out. If people are already in the room, you join them on their map." }],
      [deployRow("Hang out", "Join the hangout. H for emotes, Enter to chat."), back("Back to the main menu.")],
    ],
  }),
  solo: () => ({
    title: "Solo Play", panel: "deploy",
    enter: () => ensureGroup("solo", "ops"),
    groups: [modeItems("solo"), [mapRow()], [deployRow("Start", "Drop in."), back("Back to the main menu.")]],
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
        checkRow("to-nobots", "No bots", "Just you (and anyone with the code). Good for walking a map."),
        checkRow("to-botstreaks", "Bot scorestreaks", "Bots earn and call their own streaks."),
      ].filter(Boolean),
      [back("Back to Private Match.")],
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
  class: () => {
    const slot = (s) => { $(`#to-lo-slot-toggle [data-slot="${s}"]`)?.click(); return strongOf(activeIn("#to-lo-list .to-lo-weapon") || document.createElement("b")); };
    const primary = text($("#to-pf-sum-name"));
    const secondary = text($("#to-pf-sum-secondary"));
    return {
      title: "Create a Class", panel: "loadout", detail: true, gun: true,
      groups: [
        [
          { id: "primary", label: "Primary", value: primary, desc: "Your main weapon.", onSelect: (_, m) => { slot("primary"); m.go("classes"); } },
          { id: "secondary", label: "Secondary", value: secondary, desc: "Your sidearm.", onSelect: (_, m) => { slot("secondary"); m.go("weapons"); } },
          { id: "atts", label: "Attachments", value: $$("#to-pf-sum-atts > *").length ? `${$$("#to-pf-sum-atts > *").length} on` : "", desc: "Optic, barrel, underbarrel, ammo and skin for your primary.", onSelect: (_, m) => { $('#to-lo-slot-toggle [data-slot="primary"]')?.click(); m.go("atts"); } },
        ],
        [back("Back to the main menu.")],
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
      [back("Back to Create a Class.")],
    ],
  }),
  weapons: () => ({
    title: text(activeIn("#to-lo-classes .to-lo-class")) || "Weapons", panel: "loadout", detail: true, gun: true,
    groups: [
      $$("#to-lo-list .to-lo-weapon").map((b, i) => {
        const sub = text($("span", b));
        const lv = sub.match(/level (\d+)/i);
        return {
          id: `w-${i}`, label: strongOf(b), on: isOn(b), disabled: isLocked(b),
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
      [back("Back to Create a Class.")],
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
        [back("Back to the main menu.")],
      ],
    };
  },
  cosmetics: () => {
    const face = $$("#to-cos-body .to-cos-face:not([data-wrist])").find(isOn);
    const tint = $$("#to-cos-body .to-cos-tint").find(isOn);
    const wrist = $$("#to-cos-body [data-wrist]").find(isOn);
    return {
      title: "Cosmetics", panel: "cosmetics",
      groups: [
        [
          { id: "face", label: "Face", value: face ? text($("span:last-child", face)) : "", desc: "Your trollface's expression. Everyone in the match sees it.", go: "faces" },
          { id: "tint", label: "Face colour", value: tint ? tint.title : "", desc: "Tints the skin; the ink stays black.", go: "tints" },
          { id: "wrist", label: "Wrist", value: wrist ? text($("span:last-child", wrist)) : "", desc: "Something on your left wrist. Everyone sees it, and so do you, in your own hands.", go: "wrists" },
        ],
        [back("Back to the main menu.")],
      ],
    };
  },
  heroes: () => optionScreen("Hero", $$("#to-lo-heroes .to-lo-hero")),
  faces: () => optionScreen("Face", $$("#to-cos-body .to-cos-face:not([data-wrist])"), { descOf: () => "Everyone in the match sees it." }),
  wrists: () => optionScreen("Wrist", $$("#to-cos-body [data-wrist]"), { descOf: (b) => (b.dataset.wrist ? "On your left wrist, every match." : "A bare wrist.") }),
  tints: () => optionScreen("Face colour", $$("#to-cos-body .to-cos-tint"), { descOf: (b) => `${b.title} skin.` }),
  leaders: { title: "Leaderboards", panel: "deploy", detail: true, lb: true, groups: [[back("Back to the main menu.")]] },
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
        checkRow("to-set-aimassist-lobby", "Aim assist", "Controller only."),
        selectRow("to-set-botskill", "Bot skill", "Veteran bots give +10% XP."),
        checkRow("to-set-viewmode-lobby", "View mode", "Just look at the maps, no fighting."),
      ].filter(Boolean),
      [
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
    const a = /^att-(\d+)$/.exec(id), g = /^gear-(\d+)$/.exec(id);
    if (a) {
      const slotEl = $$("#to-lo-atts .to-lo-slot")[+a[1]];
      if (slotEl) return () => optionScreen(text($(".to-lo-slot-label", slotEl)), $$(".to-lo-att, button", slotEl), {
        descOf: (b) => text($("small", b)) || b.title,
        valueFor: (b) => $$(".to-att-delta b", b).map(text).join(" "),
      });
    }
    if (g) {
      const row = $$("#to-lo-gear .to-lo-gearrow")[+g[1]];
      if (row) return () => optionScreen(text($(".to-lo-slot-label", row)), $$(".to-lo-gear", row), { valueFor: (b) => text($("span", b)) });
    }
    return undefined;
  },
  has(t, id) { return id in t || /^(att|gear)-\d+$/.test(id); },
});

/* U Mad Bro? teaser: while its mode row is hot (locked or not), the detail
   pane shows the hero banners, the two album-cover parodies taking turns.
   onHot fires before onScreen on a re-render, so onScreen re-applies it. */
const UMB_BANNERS = ["umb-agents", "umb-highway"].map((n) => `assets/games/troll-ops/ui/${n}.jpg?v=umb1`);
let lastHot = null, screenDetail = false, umbTimer = 0, umbIdx = 0;
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
    // Phones size the operator and the detail pane from the list's height.
    pf.style.setProperty("--menu-h", `${nav.offsetHeight}px`);
    screenDetail = !!s.detail || id === "search" || id === "pinsearch";
    root.classList.toggle("has-detail", screenDetail);
    root.classList.toggle("has-gun", !!s.gun);
    root.classList.toggle("has-lb", !!s.lb);
    lbHost.hidden = !s.lb;
    if (s.lb && !lbHost.dataset.mounted) { lbHost.dataset.mounted = "1"; lbHost.id = "to-bo2-lb"; window.TrollLeaderboard?.mount?.("troll-ops", "#to-bo2-lb"); }
    shot.hidden = id !== "maps";
    if (id !== "barracks") clanEditing = false;
    cardHost.hidden = !s.card;
    root.classList.toggle("has-card", !!s.card);
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
    if (!it) return;
    if (it.mapId) {
      const img = $("img", shot);
      setMapShot(img, it.mapId, `${Math.ceil(shot.parentElement?.clientWidth || 640)}px`);
      $("figcaption", shot).textContent = it.desc || "";
    }
    // Streak previews: the old picker shows the model on hover/focus.
    if (it.card) { it.card.dispatchEvent(new MouseEvent("mouseenter")); it.card.dispatchEvent(new FocusEvent("focus")); }
  },
});
$(".to-bo2-back", root).addEventListener("click", () => menu.back());

/* ── Party, status, presence ──────────────────────────────────────────── */
function renderParty() {
  const p = window.TrollrunnerAccounts?.getCachedProfile?.();
  const roster = $$("#to-pf-roster .to-pf-op").length;
  $(".to-bo2-party-lbl", root).innerHTML = `${Math.max(1, roster)} Player${roster > 1 ? "s" : ""} <span>(8 Max)</span>`;
  $(".to-bo2-name", root).textContent = p?.username ? withClan(p.username, getMyCard().clan) : "Guest troll";
  const rankEl = $("#to-lo-rank-label"), owner = !!rankEl?.classList.contains("is-owner");
  const lv = $(".to-bo2-lv", root);
  lv.textContent = owner ? "Owner" : (text(rankEl) || "Level 1").replace(/Level/i, "LV");
  // the rank or prestige icon in front, as in the loadout strip
  const icon = !owner && rankEl?.querySelector("svg");
  if (icon) lv.prepend(icon.cloneNode(true));
  lv.classList.toggle("has-rank-icon", !!icon);
  lv.classList.toggle("is-owner", owner);   // the owner badge, no level (style.css)
  $(".to-bo2-xp", root).textContent = p ? text($("#to-pf-xp")) : "Log in to keep your XP";
}
// Your name: your profile card when signed in, the sign-in when not.
$(".to-bo2-party-row", root).addEventListener("click", () => {
  const id = myUid();
  if (id) openProfileCard(id);
  else $("#to-pf-profile")?.click();
});
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

joinSitePresence({ onCount: (n) => { $(".to-bo2-online", root).textContent = `${n} Online`; } });

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

/* ── Animations switch (bottom right) ─────────────────────────────────
   For slow laptops (user, 2026-10-03): off freezes the planet and the
   asteroids, drops the menu's CSS animations (body.tf-anim-off), and
   game.js cuts the solo pre-match countdown short. Remembered per device. */
const ANIM_KEY = "tf-anim-off";
const animBtn = $(".to-bo2-anim", root);
let animOff = false;
try { animOff = localStorage.getItem(ANIM_KEY) === "1"; } catch {}
function applyAnim() {
  document.body.classList.toggle("tf-anim-off", animOff);
  animBtn.setAttribute("aria-checked", String(!animOff));
  $("b", animBtn).textContent = animOff ? "Off" : "On";
  backdrop?.setStill?.(animOff);
}
animBtn.addEventListener("click", () => {
  animOff = !animOff;
  try { animOff ? localStorage.setItem(ANIM_KEY, "1") : localStorage.removeItem(ANIM_KEY); } catch {}
  applyAnim();
});
applyAnim();

/* ── The planet: lazy, and paused whenever the lobby isn't showing ───── */
const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 300));
function coverOn(on) { document.body.classList.toggle("to-bo2-cover", on); }
idle(async () => {
  try {
    const { mountMenuBackdrop } = await import("../../js/menu-globe.js?v=to-bo2e");
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

window.__toBo2 = { menu, get backdrop() { return backdrop; } };   // for headless tests
