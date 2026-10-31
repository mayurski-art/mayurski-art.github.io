/* Trollnite's lobby, Fortnite style (user, 2026-10-26; the design doc
   "Trollnite Lobby Redesign", phase 1). A tab bar along the top, glass
   panels at the sides, the mode card with PLAY bottom right, over a reel of
   the maps (mountReel below).

   menu-bo2.js is still the engine: every screen (Public Match, Create a
   Class, the Barracks...) is its list, drawn here as a glass panel. This
   module adds the chrome around it and the Play tab's own front page, the
   way menu-bo2.js wraps the old lobby: it reads the lobby's buttons and asks
   the menu to go places, it owns no game state. Everything it needs comes in
   through mountFnLobby(), so it imports nothing (no second copy of a module
   under another ?v= tag) but core/season.js, which holds no state: the
   season's dates and Halloween, shared with the Zombies hub; and
   new-here.js, I'M NEW HERE's sheet, which holds none either. */
import { SEASON, seasonLeft, halloween } from "../core/season.js?v=zf1-wb1";
import { mountNewHere } from "./new-here.js?v=nwh1-mb1-mb2";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const text = (el) => (el ? el.textContent.trim().replace(/\s+/g, " ") : "");
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/* The tabs, and the screen each opens (Play is the front page, "main"). */
/* `icon`: what an upright phone shows in its place (all six fit there) */
const TABS = [
  { id: "play", label: "Play", screen: "main", icon: "M8 5v14l11-7z" },
  { id: "locker", label: "Locker", screen: "locker", icon: "M9 3 4 6 2 11l3 1v9h14v-9l3-1-2-5-5-3a3 3 0 0 1-6 0z" },
  { id: "career", label: "Career", screen: "barracks", icon: "m12 2 2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17l-6.1 3.4 1.5-6.8L2.2 9l6.9-.7z" },
  { id: "compete", label: "Compete", screen: "leaders", icon: "M7 3h10v2h4v3a4 4 0 0 1-4 4h-.4A5 5 0 0 1 13 15v3h3v3H8v-3h3v-3a5 5 0 0 1-3.6-3H7a4 4 0 0 1-4-4V5h4zM5 7v1a2 2 0 0 0 2 2V7zm14 0h-2v3a2 2 0 0 0 2-2z" },
  { id: "quests", label: "Quests", screen: "quests", icon: "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm5.6 12.6 7-7-1.4-1.4-5.6 5.6-2.8-2.8-1.4 1.4z" },
  { id: "options", label: "Options", screen: "options", icon: "M13.9 3h-3.8l-.4 2.6a7 7 0 0 0-1.8 1L5.4 5.7 3.5 9l2 1.6a7 7 0 0 0 0 2.8l-2 1.6 1.9 3.3 2.5-.9a7 7 0 0 0 1.8 1l.4 2.6h3.8l.4-2.6a7 7 0 0 0 1.8-1l2.5.9 1.9-3.3-2-1.6a7 7 0 0 0 0-2.8l2-1.6-1.9-3.3-2.5.9a7 7 0 0 0-1.8-1zM12 15.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4z" },
];
/* Screens reached from a tab's screen stay under that tab. */
const TAB_OF = {
  main: "play", public: "play", social: "play", solo: "play", zombies: "play", zcoop: "play", private: "play", room: "play", maps: "play", heroes: "play", online: "play",
  locker: "locker", classlist: "locker", classes: "locker", class: "locker", weapons: "locker", atts: "locker", gear: "locker", streaks: "locker",
  cosmetics: "locker", bodies: "locker", faces: "locker", wrists: "locker", cards: "locker",
  barracks: "career", record: "career", rewards: "career", prestige: "career",
  leaders: "compete", quests: "quests", options: "options",
};
const tabOf = (id) => TAB_OF[id] || (/^(att|gear|perk)-\d+$/.test(id) ? "locker" : null);

/* The playlists the mode card offers: the BO2 main list's five. `group` is
   the lobby's mode group, so the card can name the mode picked in it. */
const PLAYLISTS = [
  { id: "public", label: "Public Match", group: "versus", sub: "Team Deathmatch", blurb: "A versus room with whoever is online. Bots fill the gaps." },
  { id: "social", label: "Socialize", group: "social", sub: "Hang out", blurb: "Troll City, Kabukigrin, Troll Beach or Undergrin. No guns, just emotes and chat." },
  { id: "solo", label: "Solo Play", group: "solo", sub: "Ops", blurb: "Ops, Zombies or the Test Range. Just you." },
  { id: "zombies", label: "Zombies", group: "hub", sub: "The hub", blurb: "Step on a map's pad. Up to four of you go in against the horde." },
  { id: "private", label: "Private Match", group: "versus", sub: "Room code", blurb: "Make a room code and send it to your friends." },
];
const PL_KEY = "tf-fn-playlist";

/* The mode tiles under the lobby (the design doc's phase 3): every way in
   as a picture, with how many people are in it now. A tile is a playlist
   (and for Royale, its mode in the Public Match list); `map` is the shot. */
const TILES = [
  { id: "royale", label: "Troll Royale", playlist: "public", mode: "royale", map: "trollface" },
  { id: "public", label: "Public Match", playlist: "public", map: "hollowgrin" },
  { id: "zombies", label: "Zombies", playlist: "zombies", map: "undergrin" },
  { id: "social", label: "Socialize", playlist: "social", map: "trollcity" },
  { id: "solo", label: "Solo Play", playlist: "solo", map: "dustbowl", note: "Just you" },
  { id: "private", label: "Private Match", playlist: "private", map: "grinsite", note: "Room code" },
];
/* Which tile someone online is in, from their presence activity (online.js
   activity()); null in a menu or another game. */
function tileOf(a) {
  if (!a || a.game !== "tf" || a.state === "menu") return null;
  if (a.state === "lobby") return /^royale(_duo|_trio|_squad)?$/.test(a.mode) ? "royale" : "public";
  if (a.room && !a.pub) return "private";
  if (!a.room) return "solo";
  if (/^royale(_duo|_trio|_squad)?$/.test(a.mode)) return "royale";
  if (a.state === "zombies" || a.mode === "zhub") return "zombies";
  if (a.mode === "social") return "social";
  return "public";
}

/* The season on the Play page's card (user, 2026-10-30: "a date range and
   countdown for how long chapter one lasts which is until november 12th
   2026"): core/season.js's SEASON and seasonLeft, shared with the Zombies
   hub's clock. */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = (d) => `${MONTHS[d.getMonth()]} ${d.getDate()}`;

/* The news carousel: what's new, each a way in (user, 2026-10-30: the
   Halloween update first, then Trollface Island, then the rest). `art`: a
   picture other than the map's shot; `side`: the Royale side it picks. */
const NEWS = [
  { title: "Halloween", tag: "Hollowgrin, the island's underside", map: "hollowgrin", art: "assets/games/troll-ops/ui/lobby/halloween/hollowgrin-1-1280.webp", playlist: "public", mode: "royale", side: "hollowgrin" },
  { title: "Trollface Island", tag: "New in Royale", map: "trollface", playlist: "public", mode: "royale", side: "trollface" },
  { title: "Kabukigrin", tag: "Hang out at night", map: "kabukigrin", playlist: "social" },
  { title: "Troll Beach", tag: "Courts are open", map: "grinbeach", playlist: "social" },
];

/* The backdrop reel (user, 2026-10-26: "a couple of photos of each map and
   then have an animated loop"): the stills of a map (ui/maps/ its map-vote
   still, ui/lobby/ three more: tools/troll-ops-lobby-reel.mjs), each held
   SHOT_MS with a slow drift, crossfading; Kabukigrin's with its two clips,
   filmed like a vlog (a walk through the club's crowd, its big screen up
   close). Whose stills (user, 2026-10-30: "the background images should be
   looped to the respective choices of the maps chosen ... if no maps are
   chosen then we should default to the trollface island one ... that
   includes hollowgrin island as well"): the map on the mode card (Royale:
   your side), else both islands' in turn (Public Match's map vote, the
   Zombies hub). */
const UI = "assets/games/troll-ops/ui";
const REEL_MAPS = ["trollface", "grinbeach", "trollcity", "hollowgrin", "undergrin", "grinsite", "culdegrin", "dustbowl", "depot", "grinleria", "kabukigrin"];
const REEL_CLIPS = ["club", "screen"];
const REEL_DEFAULT = ["trollface", "hollowgrin"];
const SHOT_MS = 7000, FADE_MS = 1400;
const CLIP_V = "c3";   // bump when the clips are re-rendered (same filenames)
const still = (id, n, w) => n ? `${UI}/lobby/${id}-${n}-${w}.webp` : `${UI}/maps/${id}-${w}.webp`;
const clip = (name) => ({ clip: (w) => `${UI}/lobby/kabukigrin-${name}-${w}` });
/* Halloween (user, 2026-10-29: the lobby "to be halloween vibes"): while it
   lasts (core/season.js: October to the end of Chapter One, 12 November) a
   map with a Halloween still shows that instead (ui/lobby/halloween/, the
   user's own Halloween edits of the reel's stills, each named for the still
   it stands in for), no clips. ?season=halloween or ?season=off forces it
   either way (the tests). */
const HALLOWEEN = ["kabukigrin-0", "culdegrin-1", "hollowgrin-1", "trollface-1", "grinleria-1", "undergrin-1", "trollcity-1", "grinbeach-1", "dustbowl-1", "depot-1"];
/* One map's pictures, in order. */
function mapReel(id) {
  const spooky = halloween() ? HALLOWEEN.filter((n) => n.startsWith(`${id}-`)) : [];
  if (spooky.length) return spooky.map((n) => ({ key: `h:${n}`, src: (w) => `${UI}/lobby/halloween/${n}-${w}.webp` }));
  const shot = (n) => ({ key: `${id}:${n}`, src: (w) => still(id, n, w) });
  if (id === "kabukigrin") return [shot(0), { key: "clip:club", ...clip(REEL_CLIPS[0]) }, shot(1), { key: "clip:screen", ...clip(REEL_CLIPS[1]) }, shot(2)];
  return REEL_MAPS.includes(id) ? [0, 1, 2, 3].map(shot) : [shot(0)];
}
/* The reel for the chosen map, or both islands' taking turns. */
function reelList(map) {
  if (map) return mapReel(map);
  const lists = REEL_DEFAULT.map(mapReel), out = [];
  for (let i = 0; i < Math.max(...lists.map((l) => l.length)); i++) for (const l of lists) if (l[i]) out.push(l[i]);
  return out;
}
const FALLBACK_AVATAR = "assets/images/icons/favicon/grin.png";

export function mountFnLobby(api) {
  const { root, menu, openQuick, royaleSide, switchRoyaleSide, royaleSize, partyView, socialMaps = [], getLevel, getPrestige, rankProgress, rankXpText, PRESTIGE_MASTER, setMapShot, ACHIEVEMENTS } = api;
  const title = $("#to-title");
  root.classList.add("is-fn");
  title.classList.add("is-fn");

  const reel = mountReel($(".to-bo2-bg", root), title);
  // Fortnite's dark bands across the top (under the tabs) and the bottom
  // (under the hints row)
  $(".to-bo2-bg", root).after(...["top", "foot"].map((k) => Object.assign(document.createElement("div"), { className: `to-fn-band is-${k}`, ariaHidden: "true" })));

  /* ── Top bar ── */
  const top = document.createElement("header");
  top.className = "to-fn-top";
  top.innerHTML = `
    <button type="button" class="to-fn-glass to-fn-ico" data-act="arcade" aria-label="Back to the Troll Runner arcade" title="Arcade">
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/></svg>
    </button>
    <nav class="to-fn-glass to-fn-tabs" aria-label="Lobby">
      <kbd class="to-fn-padkey" aria-hidden="true">LB</kbd>
      ${TABS.map((t) => `<button type="button" class="to-fn-tab" data-tab="${t.id}" title="${t.label}"><svg class="to-fn-tab-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="${t.icon}"/></svg><span class="to-fn-tab-lbl">${t.label}</span><i class="to-fn-dot" hidden></i></button>`).join("")}
      <kbd class="to-fn-padkey" aria-hidden="true">RB</kbd>
    </nav>
    <div class="to-fn-me">
      <button type="button" class="to-fn-glass to-fn-lvl" data-act="career" aria-label="Your level">
        <span class="to-fn-pres" hidden></span><b class="to-fn-lv"></b>
      </button>
      <button type="button" class="to-fn-avatar" data-act="me" aria-label="Your Barracks"><img alt="" src="${FALLBACK_AVATAR}"><i aria-hidden="true"></i></button>
    </div>`;
  root.appendChild(top);
  const tabs = $$(".to-fn-tab", top);

  /* ── Play tab, left: season, level, prestige, challenges (Fortnite's
     Chapter 1 lobby: one block, the level big beside its crest) ── */
  const left = document.createElement("section");
  left.className = "to-fn-left";
  left.setAttribute("aria-label", "Season");
  left.innerHTML = `
    <div class="to-fn-glass to-fn-season"><span>Season: OG</span><b>Chapter One</b>
      <small class="to-fn-season-time"><i class="to-fn-season-dates">${day(SEASON.start)} – ${day(SEASON.end)}</i><em><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><span class="to-fn-season-left"></span></em></small></div>
    <div class="to-fn-pair">
      <button type="button" class="to-fn-glass to-fn-rank" data-act="career">
        <span class="to-fn-crest" aria-hidden="true"><img alt="" src="${FALLBACK_AVATAR}"></span>
        <span class="to-fn-lvbox"><span class="to-fn-lvline"><small>Level</small><b class="to-fn-lvnum"></b></span>
          <span class="to-fn-bar"><i aria-hidden="true"></i><strong class="to-fn-xp"></strong></span></span>
      </button>
      <button type="button" class="to-fn-glass to-fn-medal" data-act="career">
        <i aria-hidden="true"></i><small>Prestige</small><strong class="to-fn-pnum"></strong>
      </button>
    </div>
    <div class="to-fn-glass to-fn-quests">
      <h2><button type="button" data-act="quests">Challenges</button></h2>
      <ol class="to-fn-qlist"></ol>
    </div>
    <button type="button" class="to-fn-newhere" data-act="newhere" aria-haspopup="dialog"><kbd class="to-fn-padkey" aria-hidden="true">Y</kbd><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M9.3 9.4a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2 1-1.2 1.8v.6"/><circle cx="12" cy="17.4" r=".4"/></svg><span>I'm new here</span></button>`;
  root.appendChild(left);
  /* I'M NEW HERE (menu/new-here.js): the tutorial, over everything */
  const help = mountNewHere(root);

  /* ── Play tab, right: the news as Fortnite's event tile, over the mode card ── */
  const news = document.createElement("section");
  news.className = "to-fn-news";
  news.setAttribute("role", "group");
  news.setAttribute("aria-roledescription", "carousel");
  news.setAttribute("aria-label", "News");
  news.innerHTML = `
      ${NEWS.map((n, i) => `<button type="button" class="to-fn-news-card" data-i="${i}" ${i ? "hidden" : ""} aria-label="${esc(`${n.title}: ${n.tag}`)}">
        <img alt="" data-map="${n.map}"><em>News</em><b>${esc(n.title)}</b><small>${esc(n.tag)}</small></button>`).join("")}
      <div class="to-fn-pips">${NEWS.map((n, i) => `<button type="button" data-i="${i}" aria-label="News ${i + 1}: ${esc(n.title)}"></button>`).join("")}</div>`;

  /* ── Play tab, right: the mode card and PLAY ── */
  const play = document.createElement("section");
  play.className = "to-fn-glass to-fn-play";
  play.setAttribute("aria-label", "Mode");
  play.innerHTML = `
    <button type="button" class="to-fn-mode" aria-haspopup="dialog" aria-expanded="false">
      <b class="to-fn-mode-name"></b><small class="to-fn-mode-sub"></small><span class="to-fn-change"><kbd class="to-fn-padkey" aria-hidden="true">X</kbd><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h14m-4-4 4 4-4 4M20 16H6m4-4-4 4 4 4"/></svg>Change mode</span>
    </button>
    <div class="to-fn-map"><img alt="" hidden><div><strong></strong><span></span></div></div>
    <div class="to-fn-size" role="group" aria-label="Team size" hidden>${(royaleSize?.().sizes || []).map((s) => `<button type="button" data-n="${s.n}" aria-pressed="false">${esc(s.label)}</button>`).join("")}</div>
    <button type="button" class="to-fn-go"><kbd class="to-fn-padkey" aria-hidden="true">A</kbd><span class="to-fn-go-text">Play</span></button>`;
  root.appendChild(play);
  play.append(news);   // (the event tile stands over the mode card)
  // its height, for the party box over it (style.css: a sideways phone's
  // party grid takes all the room down to it)
  new ResizeObserver(() => root.style.setProperty("--fn-play-h", `${play.offsetHeight}px`)).observe(play);
  const picker = document.createElement("div");
  picker.className = "to-fn-glass to-fn-picker";
  picker.setAttribute("role", "dialog");
  picker.setAttribute("aria-label", "Pick a mode");
  picker.hidden = true;
  picker.innerHTML = `<h2>Pick a mode</h2>${PLAYLISTS.map((p) => `<button type="button" data-pl="${p.id}"><b>${esc(p.label)}</b><small>${esc(p.blurb)}</small></button>`).join("")}`;
  root.appendChild(picker);

  /* ── Play tab, below: every mode as a tile (scroll down, or All modes) ── */
  const more = document.createElement("button");
  more.type = "button";
  more.className = "to-fn-glass to-fn-allmodes";
  more.setAttribute("aria-expanded", "false");
  more.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>All modes`;
  root.appendChild(more);
  const modes = document.createElement("section");
  modes.className = "to-fn-modes";
  modes.setAttribute("role", "dialog");
  modes.setAttribute("aria-label", "All modes");
  modes.hidden = true;
  modes.innerHTML = `
    <header><h2>Trollnite<small>Pick how you play</small></h2>
      <button type="button" class="to-fn-glass to-fn-modes-x" aria-label="Back to the lobby"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg></button></header>
    <div class="to-fn-tiles">${TILES.map((t) => `<button type="button" class="to-fn-tile" data-tile="${t.id}">
      <span class="to-fn-tile-art"><img alt="" loading="lazy" data-map="${t.map}"><b>${esc(t.label)}</b></span>
      <span class="to-fn-tile-n"></span></button>`).join("")}</div>`;
  root.appendChild(modes);

  /* ── State ── */
  let playlist = "public";
  try { const v = localStorage.getItem(PL_KEY); if (PLAYLISTS.some((p) => p.id === v)) playlist = v; } catch {}
  let tab = "play";

  function modeIn(group) {
    // the picked mode's name, when it's in this playlist's group
    let g = null, hit = null;
    for (const el of $("#to-lo-mode")?.children || []) {
      if (el.classList.contains("to-lo-modegroup")) g = text(el).toLowerCase();
      else if (g === group && el.classList.contains("is-active")) hit = text($("span", el));
    }
    return hit;
  }
  function renderPlay() {
    const p = PLAYLISTS.find((x) => x.id === playlist) || PLAYLISTS[0];
    $(".to-fn-mode-name", play).textContent = p.label;
    $(".to-fn-mode-sub", play).textContent = (p.id === "public" || p.id === "solo" ? modeIn(p.group) : null) || p.sub;
    const map = $(".to-fn-map", play), img = $("img", map);
    let active = $("#to-lo-maps .to-lo-map.is-active");
    // Socialize plays only its own maps: a pick outside them gets its first
    // (loadout.js versusMapId), so the card names that one
    if (p.id === "social" && socialMaps.length && !socialMaps.includes(active?.dataset.map)) active = $(`#to-lo-maps [data-map="${socialMaps[0]}"]`);
    let name = "", sub = "";
    // Troll Royale: the side you start on (royale-side.js), not a vote
    const side = p.id === "public" && $('#to-lo-mode [data-mode="royale"]')?.classList.contains("is-active") && royaleSide?.();
    if (side) { name = side.name; sub = `${side.tag === "Default" ? "Default island" : side.tag} · change`; }
    else if (p.id === "public") { name = "Map vote"; sub = "Vote with the lobby"; }
    else if (p.id === "zombies") { name = "The hub"; sub = "A pad for every map"; }
    else if (active) { name = text($(".to-map-name", active)); sub = p.id === "social" ? "Join whoever's there" : "Your map"; }
    $("strong", map).textContent = name;
    $("span", map).textContent = sub;
    const mapId = side ? side.id : p.id !== "public" && p.id !== "zombies" ? active?.dataset.map : null;
    reel.setMap(mapId || null);
    img.hidden = !mapId;
    if (mapId && img.dataset.map !== mapId) { img.dataset.map = mapId; setMapShot(img, mapId, "120px"); }
    map.hidden = !name;
    // Royale: the card switches the side (the Island row in Public Match does too)
    map.classList.toggle("is-side", !!side);
    // Royale: Solo / Duo / Trio / Squad (royale-squads.js); none smaller
    // than the party
    const size = $(".to-fn-size", play), rs = side && royaleSize?.();
    size.hidden = !rs;
    if (rs) for (const b of $$("button", size)) {
      const n = +b.dataset.n, on = n === rs.cur, small = n < rs.min;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-pressed", String(on));
      b.disabled = small;
      b.title = small ? `Your party is ${rs.min}` : `Troll Royale ${b.textContent}`;
    }
    if (side) { map.setAttribute("role", "button"); map.tabIndex = 0; map.setAttribute("aria-label", `Island: ${side.name}, ${side.tag}. Switch side`); }
    else { map.removeAttribute("role"); map.removeAttribute("tabindex"); map.removeAttribute("aria-label"); }
  }
  window.addEventListener("tf-royale-side", () => renderPlay());
  window.addEventListener("tf-royale-size", () => renderPlay());
  addEventListener("trollforces:party", () => renderPlay());
  $(".to-fn-size", play).addEventListener("click", (e) => { const b = e.target.closest("button"); if (b && !b.disabled) royaleSize?.().pick(+b.dataset.n); });
  // signed in on another device: its mode card and Royale side come with it
  addEventListener("trollforces:cloud-restored", (e) => {
    if (e.detail?.includes(PL_KEY)) { try { const v = localStorage.getItem(PL_KEY); if (PLAYLISTS.some((p) => p.id === v)) playlist = v; } catch {} }
    if (e.detail?.some((k) => k === PL_KEY || k === "trollops:royaleSide" || k === "trollops:achievements")) { renderPlay(); renderMe(); }
  });
  {
    const map = $(".to-fn-map", play), flip = () => { if (map.classList.contains("is-side")) switchRoyaleSide?.(); };
    map.addEventListener("click", flip);
    map.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); } });
  }
  function setPlaylist(id) {
    playlist = id;
    try { localStorage.setItem(PL_KEY, id); } catch {}
    renderPlay();
  }

  function openPicker(on) {
    picker.hidden = !on;
    $(".to-fn-mode", play).setAttribute("aria-expanded", String(on));
    if (on) ($(`[data-pl="${playlist}"]`, picker) || $("button", picker)).focus();
  }
  $(".to-fn-mode", play).addEventListener("click", () => openPicker(picker.hidden));
  picker.addEventListener("click", (e) => {
    const b = e.target.closest("[data-pl]");
    if (!b) return;
    setPlaylist(b.dataset.pl);
    openPicker(false);
    $(".to-fn-go", play).focus();
  });
  document.addEventListener("click", (e) => {
    if (!picker.hidden && !picker.contains(e.target) && !e.target.closest(".to-fn-mode")) openPicker(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !picker.hidden) { e.preventDefault(); e.stopPropagation(); openPicker(false); $(".to-fn-mode", play).focus(); }
  }, true);
  // PLAY opens the playlist's own screen: its modes, map vote, and the go button
  $(".to-fn-go", play).addEventListener("click", () => menu.go(playlist));
  /* In someone else's party, or the joined squad whose leader didn't ask:
     their leader starts the match (user, 2026-10-30), so PLAY waits for
     them instead of taking you off on your own. */
  function renderGo() {
    const v = partyView?.(), go = $(".to-fn-go", play);
    const leader = !v ? null : !v.host ? v.people.find((p) => p.host)?.name || "your leader"
      : v.squad && !v.squad.lead ? v.squad.people[0]?.name || "the other leader" : null;
    go.disabled = !!leader;
    go.classList.toggle("is-waiting", !!leader);
    $(".to-fn-go-text", go).textContent = leader ? `Waiting for ${leader}` : "Play";
    go.setAttribute("aria-label", leader ? `Waiting for ${leader} to start the match` : "Play");
  }
  addEventListener("trollforces:party", renderGo);
  renderGo();

  /* ── Mode tiles ── */
  let online = [];
  const modeBtn = (id) => $(`#to-lo-mode [data-mode="${id}"]`);
  const royaleOn = () => !!modeBtn("royale")?.classList.contains("is-active");
  function renderTiles() {
    const n = {};
    for (const o of online) { const t = tileOf(o.activity); if (t) n[t] = (n[t] || 0) + 1; }
    const cur = playlist === "public" && royaleOn() ? "royale" : playlist;
    for (const b of $$(".to-fn-tile", modes)) {
      const t = TILES.find((x) => x.id === b.dataset.tile);
      const lock = t.mode ? modeBtn(t.mode)?.dataset.lock : "";
      const count = n[t.id] || 0;
      const line = lock ? `Unlocks at ${lock}` : t.note || (count ? `${count} playing` : "Nobody yet");
      $(".to-fn-tile-n", b).innerHTML = (t.note || lock ? "" : `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z"/></svg>`) + esc(line);
      b.classList.toggle("is-on", t.id === cur);
      b.disabled = !!lock;
      b.setAttribute("aria-pressed", String(t.id === cur));
      b.setAttribute("aria-label", `${t.label}: ${line}`);
    }
  }
  function openModes(on) {
    if (on === !modes.hidden) return;
    modes.hidden = !on;
    more.setAttribute("aria-expanded", String(on));
    root.classList.toggle("is-fn-modes", on);
    if (on) {
      openPicker(false);
      for (const img of $$(".to-fn-tile img", modes)) if (!img.src) setMapShot(img, img.dataset.map, "320px");
      renderTiles();
      ($(".to-fn-tile.is-on", modes) || $(".to-fn-tile:not(:disabled)", modes))?.focus();
    }
  }
  more.addEventListener("click", () => openModes(modes.hidden));
  $(".to-fn-modes-x", modes).addEventListener("click", () => { openModes(false); more.focus(); });
  modes.addEventListener("click", (e) => {
    const b = e.target.closest(".to-fn-tile");
    if (!b || b.disabled) return;
    const t = TILES.find((x) => x.id === b.dataset.tile);
    // Royale is a mode in the Public Match list; Public Match leaves it
    if (t.mode) { const m = modeBtn(t.mode); if (m && !m.disabled) m.click(); }
    else if (t.id === "public" && royaleOn()) modeBtn("tdm")?.click();
    setPlaylist(t.playlist);
    openModes(false);
    $(".to-fn-go", play).focus();
  });
  // scroll down on the Play page for the tiles, up (or Esc) to come back
  // (on the title, before the operator's view: on Play its wheel is this,
  // not its zoom)
  title.addEventListener("wheel", (e) => {
    if (menu.current() !== "main") return;
    if (e.target.closest(".to-bo2-party-others, .to-fn-picker, .to-bo2-panel, .tr-pincard, .to-nh")) return;
    if (e.target.closest(".to-char-view")) e.stopPropagation();
    if (Math.abs(e.deltaY) < 4) return;
    if (e.deltaY > 0 && modes.hidden) openModes(true);
    else if (e.deltaY < 0 && !modes.hidden && !e.target.closest(".to-fn-tiles")?.scrollTop) openModes(false);
  }, { passive: true, capture: true });
  // (not when the key is in the radio: its player opens over the sheet, and
  // Esc there shuts the radio, the layer it's in, not the sheet behind)
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modes.hidden && !e.target.closest?.("#to-radio")) { e.preventDefault(); e.stopPropagation(); openModes(false); more.focus(); }
  }, true);
  addEventListener("trollforces:online", (e) => { online = e.detail || []; if (!modes.hidden) renderTiles(); });

  /* ── Tabs ── */
  function goTab(id) {
    const t = TABS.find((x) => x.id === id);
    if (!t) return;
    openPicker(false);
    if (t.screen === "main") menu.backTo("main");
    else openQuick(t.screen);
  }
  for (const b of tabs) b.addEventListener("click", () => goTab(b.dataset.tab));
  top.addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "arcade") api.toArcade();
    else if (act === "career") goTab("career");
    else if (act === "me") $(".to-bo2-party-row.is-me", root)?.click();   // Barracks, or sign in
  });
  left.addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "newhere") help.open();
    else if (act) goTab(act);
  });

  /* ── News: turns by itself, slowly (user, 2026-10-31: "it should auto
     loop slowly by itself. manual control can be done as well by clicking
     on the four circles"): a crossfade every NEWS_MS, the lit circle
     filling as it waits; held while the pointer or focus is on it. A card
     opens its playlist. ── */
  const NEWS_MS = 8000;
  news.style.setProperty("--news-ms", `${NEWS_MS}ms`);
  let newsIdx = 0, newsTimer = 0, newsHeld = false;
  const cards = $$(".to-fn-news-card", news), pips = $$(".to-fn-pips button", news);
  function showNews(i) {
    newsIdx = (i + NEWS.length) % NEWS.length;
    cards.forEach((c, k) => { c.hidden = k !== newsIdx; });
    pips.forEach((p, k) => p.setAttribute("aria-current", String(k === newsIdx)));
  }
  for (const c of cards) {
    const n = NEWS[+c.dataset.i];
    if (n.art) $("img", c).src = n.art; else setMapShot($("img", c), n.map, "320px");
    c.addEventListener("click", () => {
      if (n.mode) { const b = $(`#to-lo-mode [data-mode="${n.mode}"]`); if (b && !b.disabled) b.click(); }
      if (n.side && royaleSide?.().id !== n.side) switchRoyaleSide?.();
      setPlaylist(n.playlist);
      $(".to-fn-go", play).focus();
    });
  }
  for (const p of pips) p.addEventListener("click", () => { showNews(+p.dataset.i); restartNews(); });
  // swipe (or drag) the card left / right for the next / last (user,
  // 2026-10-30: "users should be able to swipe through the four news")
  {
    let x0 = null, y0 = 0, swiped = false;
    news.addEventListener("pointerdown", (e) => { x0 = e.clientX; y0 = e.clientY; swiped = false; });
    news.addEventListener("pointerup", (e) => {
      if (x0 == null) return;
      const dx = e.clientX - x0, dy = e.clientY - y0;
      x0 = null;
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
      swiped = true;
      showNews(newsIdx + (dx < 0 ? 1 : -1));
      restartNews();
    });
    news.addEventListener("pointercancel", () => { x0 = null; });
    // (a swipe isn't a tap: the card's click doesn't open its mode)
    news.addEventListener("click", (e) => { if (swiped) { e.stopPropagation(); e.preventDefault(); swiped = false; } }, true);
    // the arrow keys too, on a focused card
    news.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      showNews(newsIdx + (e.key === "ArrowRight" ? 1 : -1));
      restartNews();
      cards[newsIdx].focus();
    });
  }
  // (one timer, restarted on every turn: a pick or a swipe gets its full wait)
  function restartNews() {
    clearTimeout(newsTimer);
    news.classList.toggle("is-held", newsHeld);
    if (newsHeld) return;
    newsTimer = setTimeout(() => {
      if (!title.hidden && !document.hidden && !document.body.classList.contains("tf-anim-off")) showNews(newsIdx + 1);
      restartNews();
    }, NEWS_MS);
  }
  const holdNews = (on) => { if (newsHeld !== on) { newsHeld = on; restartNews(); } };
  news.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") holdNews(true); });
  news.addEventListener("pointerleave", () => holdNews(news.contains(document.activeElement)));
  news.addEventListener("focusin", () => holdNews(true));
  news.addEventListener("focusout", (e) => { if (!news.contains(e.relatedTarget)) holdNews(news.matches(":hover")); });
  showNews(0);
  restartNews();

  /* ── The season's countdown: each minute, while the menu is up ── */
  const seasonEl = $(".to-fn-season-left", left);
  const tickSeason = () => { if (!title.hidden) seasonEl.textContent = seasonLeft(); };
  tickSeason();
  setInterval(tickSeason, 60000);
  new MutationObserver(tickSeason).observe(title, { attributes: true, attributeFilter: ["hidden"] });

  /* ── Rank, prestige, challenges ── */
  function done() {
    try { return new Set(JSON.parse(localStorage.getItem("trollops:achievements")) || []); } catch { return new Set(); }
  }
  function renderMe() {
    const profile = window.TrollrunnerAccounts?.getCachedProfile?.();
    const lv = getLevel(), pres = getPrestige();
    const owner = lv == null;
    $(".to-fn-lv", top).textContent = owner ? "Owner" : `LV ${lv}`;
    const pb = $(".to-fn-pres", top);
    pb.hidden = !pres;
    pb.textContent = pres >= PRESTIGE_MASTER ? "PM" : `P${pres}`;
    $(".to-fn-lvl", top).setAttribute("aria-label", owner ? "Owner. Open your Career" : `Level ${lv}${pres ? `, prestige ${pres}` : ""}. Open your Career`);
    const av = $(".to-fn-avatar img", top);
    const url = profile?.avatarUrl;
    av.src = url && /^https:\/\//.test(url) ? url : FALLBACK_AVATAR;
    $(".to-fn-avatar", top).classList.toggle("is-guest", !profile);
    $(".to-fn-avatar", top).setAttribute("aria-label", profile ? "Your Barracks" : "Sign in");

    $(".to-fn-rank", left).style.setProperty("--p", owner ? 1 : rankProgress());
    $(".to-fn-lvnum", left).textContent = owner ? "★" : String(lv);
    $(".to-fn-xp", left).textContent = owner ? "Owner" : profile ? (rankXpText() || "") : "Sign in for XP";
    $(".to-fn-pnum", left).textContent = pres >= PRESTIGE_MASTER ? "Master" : pres ? `P${pres}` : "None yet";
    $(".to-fn-medal", left).classList.toggle("is-none", !pres);

    // Challenges: the achievements you haven't got yet first
    const have = done();
    const all = Object.values(ACHIEVEMENTS);
    const list = [...all.filter((a) => !have.has(a.id)), ...all.filter((a) => have.has(a.id))].slice(0, 3);
    $(".to-fn-qlist", left).innerHTML = list.map((a) => {
      const ok = have.has(a.id);
      return `<li class="${ok ? "is-done" : ""}" title="${esc(a.blurb)}"><span>${esc(a.name)}<small class="to-fn-sr">: ${esc(a.blurb)}</small></span><em>${ok ? "Done" : "To do"}</em>
        <i aria-hidden="true"><b style="width:${ok ? 100 : 4}%"></b></i></li>`;
    }).join("");
    const left_ = all.filter((a) => !have.has(a.id)).length;
    lockerDot();
    const dot = $('[data-tab="quests"] .to-fn-dot', top);
    dot.hidden = !left_;
    $('[data-tab="quests"]', top).setAttribute("aria-label", left_ ? `Quests, ${left_} to do` : "Quests");
  }

  /* The Locker tab's dot: something new in it, not seen yet (an item the
     server gave: progression/grants.js keeps the list, per account, in
     localStorage; read here so this module still imports nothing). */
  function lockerDot() {
    const id = window.TrollrunnerAccounts?.getCachedProfile?.()?.id;
    let fresh = 0;
    try { fresh = id ? (JSON.parse(localStorage.getItem("trollops:new-items") || "{}")[id] || []).length : 0; } catch {}
    $('[data-tab="locker"] .to-fn-dot', top).hidden = !fresh;
    $('[data-tab="locker"]', top).setAttribute("aria-label", fresh ? "Locker, something new" : "Locker");
  }
  addEventListener("trollforces:grants", lockerDot);
  lockerDot();

  /* ── Follow the menu: which tab, and the Play page only on "main" ── */
  function onScreen() {
    const id = menu.current();
    tab = tabOf(id) || tab;
    for (const b of tabs) {
      const on = b.dataset.tab === tab;
      b.classList.toggle("is-on", on);
      if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    }
    // (the CSS keys off data-screen="main", set before menu-bo2.js measures
    // the list: a class set here, after it, hid the list while it measured)
    const home = id === "main";
    left.hidden = !home;
    news.hidden = !home;
    play.hidden = !home;
    more.hidden = !home;
    if (!home) { openPicker(false); openModes(false); help.close(); }
    if (home) { renderPlay(); renderMe(); }
    // the operator on the pad stands on the Play page only (lobby.js)
    dispatchEvent(new Event("trollforces:fn-screen"));
  }
  new MutationObserver(onScreen).observe(root, { attributes: true, attributeFilter: ["data-screen"] });
  // the lobby's own lists change under us (a mode or map picked, signing in)
  for (const el of [$("#to-lo-mode"), $("#to-lo-maps"), $("#to-lo-rank-label")]) {
    if (el) new MutationObserver(() => { if (menu.current() === "main") { renderPlay(); renderMe(); } }).observe(el, { subtree: true, attributes: true, attributeFilter: ["class"], childList: true, characterData: true });
  }
  for (const ev of ["trollrunner:auth-changed", "trollforces:prestige-changed", "trollforces:card-changed"]) {
    window.addEventListener(ev, () => setTimeout(renderMe, 60));
  }
  // coming back from a match: the challenges may have moved
  new MutationObserver(() => { if (!title.hidden) renderMe(); }).observe(title, { attributes: true, attributeFilter: ["hidden"] });
  onScreen();

  /* ── A controller in the lobby (phase 6). LB / RB change tabs; the d-pad or
     left stick moves, A picks, B goes back. On Play: A is PLAY, X Change
     mode, Y I'm new here, down All modes. The lists are menu-bo2.js's,
     driven with the keys it already takes. The buttons' hints show while a
     pad is in. ── */
  const pad = { prev: {}, held: null, next: 0, raf: 0 };
  const key = (k) => document.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
  const focusIn = (box, d, cols = 1) => {
    const all = $$("button:not(:disabled)", box).filter((b) => b.offsetParent);
    const i = all.indexOf(document.activeElement);
    const step = d === "up" ? -cols : d === "down" ? cols : d === "left" ? -1 : 1;
    const to = i < 0 ? all[0] : all[Math.max(0, Math.min(all.length - 1, i + step))];
    to?.focus();
  };
  function padMove(d) {
    if (help.isOpen()) help.padMove(d);
    else if (!modes.hidden) {
      const cols = getComputedStyle($(".to-fn-tiles", modes)).gridTemplateColumns.split(" ").filter(Boolean).length || 1;
      if (d === "up" && $$(".to-fn-tile", modes).indexOf(document.activeElement) < cols) openModes(false);
      else focusIn($(".to-fn-tiles", modes), d, cols);
    } else if (!picker.hidden) focusIn(picker, d === "left" ? "up" : d === "right" ? "down" : d);
    else if (menu.current() === "main") { if (d === "down") openModes(true); }
    else key({ up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" }[d]);
  }
  function padPress(i) {
    if (help.isOpen()) help.padPress(i);
    else if (i === 3 && menu.current() === "main" && modes.hidden && picker.hidden) help.open();
    else if (i === 4 || i === 5) {
      const at = TABS.findIndex((t) => t.id === tab);
      goTab(TABS[(at + (i === 5 ? 1 : TABS.length - 1)) % TABS.length].id);
    } else if (i === 1) {
      if (!modes.hidden) openModes(false);
      else if (!picker.hidden) openPicker(false);
      else if (menu.current() !== "main") key("Escape");
    } else if (i === 0) {
      const a = document.activeElement;
      if ((!modes.hidden || !picker.hidden) && a?.closest(".to-fn-modes, .to-fn-picker")) a.click();
      else if (menu.current() === "main" && modes.hidden && picker.hidden) $(".to-fn-go", play).click();
      else if (a && $(".to-bo2-menu", root)?.contains(a)) a.click();
      else key("Enter");
    } else if (i === 2 && menu.current() === "main" && modes.hidden) openPicker(picker.hidden);
  }
  function pollPad() {
    pad.raf = 0;
    const gp = [...(navigator.getGamepads?.() || [])].find((p) => p && p.connected);
    root.classList.toggle("has-pad", !!gp);
    if (!gp) { pad.prev = {}; return; }
    pad.raf = requestAnimationFrame(pollPad);
    // the lobby's only while it's up, and not while the emote wheel has the pad
    if (title.hidden || $(".to-emote-wheel:not([hidden])")) { pad.prev = {}; pad.held = null; return; }
    const b = (i) => !!gp.buttons[i]?.pressed;
    // the boot screen's while it's up (menu/boot-screen.js): the press that
    // enters the menu is no press here, it has to be let go first
    if (document.body.classList.contains("tf-booting")) { for (const i of [0, 1, 2, 3, 4, 5]) pad.prev[i] = b(i); pad.held = null; return; }
    for (const i of [0, 1, 2, 3, 4, 5]) if (b(i) && !pad.prev[i]) padPress(i);
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    const dir = b(12) || ay < -0.6 ? "up" : b(13) || ay > 0.6 ? "down" : b(14) || ax < -0.6 ? "left" : b(15) || ax > 0.6 ? "right" : null;
    const now = performance.now();
    if (dir !== pad.held) { pad.held = dir; if (dir) { padMove(dir); pad.next = now + 380; } }
    else if (dir && now >= pad.next) { padMove(dir); pad.next = now + 130; }   // held: repeats
    pad.prev = {};
    for (const i of [0, 1, 2, 3, 4, 5]) pad.prev[i] = b(i);
  }
  const startPad = () => { if (!pad.raf) pad.raf = requestAnimationFrame(pollPad); };
  addEventListener("gamepadconnected", startPad);
  new MutationObserver(() => { if (!title.hidden) startPad(); }).observe(title, { attributes: true, attributeFilter: ["hidden"] });
  startPad();

  return { setPlaylist, playlist: () => playlist, goTab, openModes, help };
}

/* ── Backdrop: the reel, no WebGL (pick 1). Two layers crossfade; the next
   picture is decoded (the clip buffered) before it fades in, and a file
   that won't load is skipped. It holds while a match is on, the tab is
   hidden, or Animations is off (then
   a still stays up and the clip is skipped). ── */
function mountReel(bg, title) {
  const width = () => (innerWidth * (devicePixelRatio || 1) > 1400 ? 1920 : 1280);
  let list = reelList(), listKey = "", gen = 0, started = false;
  const layers = [0, 1].map(() => {
    const d = document.createElement("div");
    d.className = "to-fn-bg";
    bg.append(d);
    return d;
  });
  // (the Animations setting only: on unless the player turned it off)
  const hold = () => document.body.classList.contains("tf-anim-off");
  const paused = () => title.hidden || document.hidden;
  let at = -1, front = 0, timer = 0, clip = null, waiting = false, flip = false;

  function load(item) {
    if (item.src) {
      const img = new Image();
      img.alt = "";
      img.decoding = "async";
      if (at < 0) img.fetchPriority = "high";
      img.src = item.src(width());
      // loaded, then decoded if the browser will (iOS Safari's decode() can
      // hang on a picture outside the page: never wait on it alone)
      return new Promise((done) => {
        const ok = () => Promise.race([img.decode?.().catch(() => {}), new Promise((r) => setTimeout(r, 600))]).then(() => done(img));
        if (img.complete && img.naturalWidth) ok();
        else {
          img.addEventListener("load", ok, { once: true });
          img.addEventListener("error", () => done(null), { once: true });
        }
      });
    }
    const v = document.createElement("video");
    Object.assign(v, { muted: true, playsInline: true, preload: "auto", disablePictureInPicture: true });
    v.setAttribute("aria-hidden", "true");
    v.src = `${item.clip(width())}.${v.canPlayType('video/webm; codecs="vp9"') ? "webm" : "mp4"}?v=${CLIP_V}`;
    return new Promise((done) => {
      const t = setTimeout(() => done(null), 20000);
      v.addEventListener("canplaythrough", () => { clearTimeout(t); done(v); }, { once: true });
      v.addEventListener("error", () => { clearTimeout(t); done(null); }, { once: true });
    });
  }
  async function show(k) {
    k %= list.length;
    const item = list[k], g = gen;
    if (item.clip && hold()) return list.some((x) => !x.clip) ? show(k + 1) : undefined;
    const el = await load(item);
    if (g !== gen) return;   // (another map was picked while this loaded)
    if (!el) { at = k; return wait(200); }
    el.className = "to-fn-shot";
    if (!item.clip && !hold()) {
      flip = !flip;   // the drift turns the other way each time
      el.classList.add("is-drift");
      el.classList.toggle("is-rev", flip);
    }
    const back = layers[1 - front];
    back.replaceChildren(el);
    back.classList.add("is-on");
    layers[front].classList.remove("is-on");
    front = 1 - front;
    clip?.pause();
    clip = item.clip ? el : null;
    at = k;
    if (clip) {
      clip.addEventListener("ended", next, { once: true });
      clip.addEventListener("error", next, { once: true });   // (a clip that won't decode moves on, never freezes the reel)
      if (paused()) waiting = true;
      else clip.play().catch(next);
    } else wait(SHOT_MS);
  }
  function wait(ms) { clearTimeout(timer); timer = setTimeout(next, ms); }
  function next() {
    if (paused() || hold()) { waiting = true; return; }
    waiting = false;
    show(at + 1);
  }
  // pause and pick up again with the menu, the tab and the Animations switch
  function sync() {
    if (paused() || hold()) {
      clearTimeout(timer);
      clip?.pause();
      waiting = true;
    } else if (waiting) {
      waiting = false;
      if (clip) clip.play().catch(next);
      else wait(FADE_MS);
    }
  }
  new MutationObserver(sync).observe(title, { attributes: true, attributeFilter: ["hidden"] });
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  document.addEventListener("visibilitychange", sync);
  // (the first picture once the Play page has said whose: lobby-fn renders
  // it straight after mounting this)
  setTimeout(() => { if (!started) { started = true; show(0); } }, 0);
  return {
    /* The map whose pictures loop (null: both islands'). A new one starts
       over on its first picture. */
    setMap(map) {
      const next = reelList(map), key = next.map((x) => x.key).join();
      if (key === listKey) return;
      listKey = key;
      list = next;
      if (!started) return;
      gen++;
      clearTimeout(timer);
      clip?.pause();
      clip = null;
      waiting = false;
      at = -1;
      show(0);
    },
  };
}
