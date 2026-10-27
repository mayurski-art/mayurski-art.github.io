/* Troll Warfare's lobby, Fortnite style (user, 2026-10-26; the design doc
   "Troll Warfare Lobby Redesign", phase 1). A tab bar along the top, glass
   panels at the sides, the mode card with PLAY bottom right, over a reel of
   the maps (mountReel below).

   menu-bo2.js is still the engine: every screen (Public Match, Create a
   Class, the Barracks...) is its list, drawn here as a glass panel. This
   module adds the chrome around it and the Play tab's own front page, the
   way menu-bo2.js wraps the old lobby: it reads the lobby's buttons and asks
   the menu to go places, it owns no game state. Everything it needs comes in
   through mountFnLobby(), so it imports nothing (no second copy of a module
   under another ?v= tag). */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const text = (el) => (el ? el.textContent.trim().replace(/\s+/g, " ") : "");
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/* The tabs, and the screen each opens (Play is the front page, "main"). */
const TABS = [
  { id: "play", label: "Play", screen: "main" },
  { id: "locker", label: "Locker", screen: "locker" },
  { id: "career", label: "Career", screen: "barracks" },
  { id: "compete", label: "Compete", screen: "leaders" },
  { id: "quests", label: "Quests", screen: "quests" },
  { id: "options", label: "Options", screen: "options" },
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
  { id: "social", label: "Socialize", group: "social", sub: "Hang out", blurb: "Troll City, Kabukigrin or Troll Beach. No guns, just emotes and chat." },
  { id: "solo", label: "Solo Play", group: "solo", sub: "Ops", blurb: "Ops, Zombies or the Test Range. Just you." },
  { id: "zombies", label: "Zombies", group: "hub", sub: "The hub", blurb: "Step on a map's pad. Up to four of you go in against the horde." },
  { id: "private", label: "Private Match", group: "versus", sub: "Room code", blurb: "Make a room code and send it to your friends." },
];
const PL_KEY = "tf-fn-playlist";

/* The news carousel: what's new, each a way in. */
const NEWS = [
  { title: "Trollface Island", tag: "New in Royale", map: "trollface", playlist: "public", mode: "royale" },
  { title: "Kabukigrin", tag: "Hang out at night", map: "kabukigrin", playlist: "social" },
  { title: "Troll Beach", tag: "Courts are open", map: "grinbeach", playlist: "social" },
];

/* The backdrop reel (user, 2026-10-26: "a couple of photos of each map and
   then have an animated loop"): three stills of each map (ui/lobby/,
   tools/troll-ops-lobby-reel.mjs; Kabukigrin's first is its map-vote still,
   ui/maps/), each held SHOT_MS with a slow drift, crossfading, maps taking
   turns; and Kabukigrin's two clips, filmed like a vlog: a walk through the
   club's crowd, and its big screen up close. */
const UI = "assets/games/troll-ops/ui";
const REEL_MAPS = ["trollface", "grinbeach", "trollcity", "hollowgrin", "undergrin", "grinsite", "culdegrin", "dustbowl", "depot", "grinleria", "kabukigrin"];
const REEL_CLIPS = ["club", "screen"];
const SHOT_MS = 7000, FADE_MS = 1400;
const CLIP_V = "c2";   // bump when the clips are re-rendered (same filenames)
const still = (id, n, w) => n ? `${UI}/lobby/${id}-${n}-${w}.webp` : `${UI}/maps/${id}-${w}.webp`;
const clip = (name) => ({ clip: (w) => `${UI}/lobby/kabukigrin-${name}-${w}` });
function reelList() {
  const out = [{ src: (w) => still("kabukigrin", 0, w) }, clip(REEL_CLIPS[0])];
  for (const n of [1, 2, 3]) {
    for (const id of REEL_MAPS) if (!(id === "kabukigrin" && n === 3)) out.push({ src: (w) => still(id, n, w) });
    if (n === 1) out.push(clip(REEL_CLIPS[1]));
  }
  return out;
}
const FALLBACK_AVATAR = "assets/images/icons/favicon/grin.png";

export function mountFnLobby(api) {
  const { root, menu, openQuick, getLevel, getPrestige, rankProgress, rankXpText, PRESTIGE_MASTER, setMapShot, ACHIEVEMENTS } = api;
  const title = $("#to-title");
  root.classList.add("is-fn");
  title.classList.add("is-fn");

  mountReel($(".to-bo2-bg", root), title);

  /* ── Top bar ── */
  const top = document.createElement("header");
  top.className = "to-fn-top";
  top.innerHTML = `
    <button type="button" class="to-fn-glass to-fn-ico" data-act="arcade" aria-label="Back to the Troll Runner arcade" title="Arcade">
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/></svg>
    </button>
    <nav class="to-fn-glass to-fn-tabs" aria-label="Lobby">
      ${TABS.map((t) => `<button type="button" class="to-fn-tab" data-tab="${t.id}">${t.label}<i class="to-fn-dot" hidden></i></button>`).join("")}
    </nav>
    <div class="to-fn-me">
      <button type="button" class="to-fn-glass to-fn-lvl" data-act="career" aria-label="Your level">
        <span class="to-fn-pres" hidden></span><b class="to-fn-lv"></b>
      </button>
      <button type="button" class="to-fn-avatar" data-act="me" aria-label="Your Barracks"><img alt="" src="${FALLBACK_AVATAR}"><i aria-hidden="true"></i></button>
    </div>`;
  root.appendChild(top);
  const tabs = $$(".to-fn-tab", top);

  /* ── Play tab, left: season, news, rank, challenges ── */
  const left = document.createElement("section");
  left.className = "to-fn-left";
  left.setAttribute("aria-label", "Season");
  left.innerHTML = `
    <div class="to-fn-glass to-fn-season"><b>Chapter One</b><span>Season: OG</span></div>
    <div class="to-fn-news" role="group" aria-roledescription="carousel" aria-label="News">
      ${NEWS.map((n, i) => `<button type="button" class="to-fn-news-card" data-i="${i}" ${i ? "hidden" : ""} aria-label="${esc(`${n.title}: ${n.tag}`)}">
        <img alt="" loading="lazy" data-map="${n.map}"><em>News</em><b>${esc(n.title)}</b><small>${esc(n.tag)}</small></button>`).join("")}
      <div class="to-fn-pips">${NEWS.map((n, i) => `<button type="button" data-i="${i}" aria-label="News ${i + 1}: ${esc(n.title)}"></button>`).join("")}</div>
    </div>
    <div class="to-fn-pair">
      <button type="button" class="to-fn-glass to-fn-rank" data-act="career">
        <span class="to-fn-ring"><b></b></span><span><small>Level</small><strong class="to-fn-xp"></strong></span>
      </button>
      <button type="button" class="to-fn-glass to-fn-medal" data-act="career">
        <i aria-hidden="true"></i><small>Prestige</small><strong class="to-fn-pnum"></strong>
      </button>
    </div>
    <div class="to-fn-glass to-fn-quests">
      <h2><button type="button" data-act="quests">Challenges</button></h2>
      <ol class="to-fn-qlist"></ol>
    </div>`;
  root.appendChild(left);

  /* ── Play tab, right: the mode card and PLAY ── */
  const play = document.createElement("section");
  play.className = "to-fn-glass to-fn-play";
  play.setAttribute("aria-label", "Mode");
  play.innerHTML = `
    <button type="button" class="to-fn-mode" aria-haspopup="dialog" aria-expanded="false">
      <b class="to-fn-mode-name"></b><small class="to-fn-mode-sub"></small><span class="to-fn-change">Change mode</span>
    </button>
    <div class="to-fn-map"><img alt="" hidden><div><strong></strong><span></span></div></div>
    <button type="button" class="to-fn-go">Play</button>`;
  root.appendChild(play);
  const picker = document.createElement("div");
  picker.className = "to-fn-glass to-fn-picker";
  picker.setAttribute("role", "dialog");
  picker.setAttribute("aria-label", "Pick a mode");
  picker.hidden = true;
  picker.innerHTML = `<h2>Pick a mode</h2>${PLAYLISTS.map((p) => `<button type="button" data-pl="${p.id}"><b>${esc(p.label)}</b><small>${esc(p.blurb)}</small></button>`).join("")}`;
  root.appendChild(picker);

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
    const active = $("#to-lo-maps .to-lo-map.is-active");
    let name = "", sub = "";
    if (p.id === "public") { name = "Map vote"; sub = "Vote with the lobby"; }
    else if (p.id === "zombies") { name = "The hub"; sub = "A pad for every map"; }
    else if (active) { name = text($(".to-map-name", active)); sub = p.id === "social" ? "Join whoever's there" : "Your map"; }
    $("strong", map).textContent = name;
    $("span", map).textContent = sub;
    const mapId = p.id !== "public" && p.id !== "zombies" ? active?.dataset.map : null;
    img.hidden = !mapId;
    if (mapId && img.dataset.map !== mapId) { img.dataset.map = mapId; setMapShot(img, mapId, "120px"); }
    map.hidden = !name;
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
    else if (act === "me") $(".to-bo2-party-row", root)?.click();   // Barracks, or sign in
  });
  left.addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act) goTab(act);
  });

  /* ── News: turns every 6s; a card opens its playlist ── */
  let newsIdx = 0, newsTimer = 0;
  const cards = $$(".to-fn-news-card", left), pips = $$(".to-fn-pips button", left);
  function showNews(i) {
    newsIdx = (i + NEWS.length) % NEWS.length;
    cards.forEach((c, k) => { c.hidden = k !== newsIdx; });
    pips.forEach((p, k) => p.setAttribute("aria-current", String(k === newsIdx)));
  }
  for (const c of cards) {
    setMapShot($("img", c), $("img", c).dataset.map, "320px");
    c.addEventListener("click", () => {
      const n = NEWS[+c.dataset.i];
      if (n.mode) { const b = $(`#to-lo-mode [data-mode="${n.mode}"]`); if (b && !b.disabled) b.click(); }
      setPlaylist(n.playlist);
      $(".to-fn-go", play).focus();
    });
  }
  for (const p of pips) p.addEventListener("click", () => { showNews(+p.dataset.i); restartNews(); });
  function restartNews() {
    clearInterval(newsTimer);
    newsTimer = setInterval(() => { if (!title.hidden && !document.body.classList.contains("tf-anim-off")) showNews(newsIdx + 1); }, 6000);
  }
  showNews(0);
  restartNews();

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

    const ring = $(".to-fn-ring", left);
    ring.style.setProperty("--p", owner ? 1 : rankProgress());
    $("b", ring).textContent = owner ? "★" : String(lv);
    $(".to-fn-xp", left).textContent = owner ? "Owner" : profile ? (rankXpText() || "") : "Sign in to keep XP";
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
    const dot = $('[data-tab="quests"] .to-fn-dot', top);
    dot.hidden = !left_;
    $('[data-tab="quests"]', top).setAttribute("aria-label", left_ ? `Quests, ${left_} to do` : "Quests");
  }

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
    play.hidden = !home;
    if (!home) openPicker(false);
    if (home) { renderPlay(); renderMe(); }
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

  return { setPlaylist, playlist: () => playlist, goTab };
}

/* ── Backdrop: the reel, no WebGL (pick 1). Two layers crossfade; the next
   picture is decoded (the clip buffered) before it fades in, and a file
   that won't load is skipped. It holds while a match is on, the tab is
   hidden, or Animations is off / the system asks for reduced motion (then
   a still stays up and the clip is skipped). ── */
function mountReel(bg, title) {
  const width = () => (innerWidth * (devicePixelRatio || 1) > 1400 ? 1920 : 1280);
  const list = reelList();
  const layers = [0, 1].map(() => {
    const d = document.createElement("div");
    d.className = "to-fn-bg";
    bg.append(d);
    return d;
  });
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const hold = () => document.body.classList.contains("tf-anim-off") || reduce.matches;
  const paused = () => title.hidden || document.hidden;
  let at = -1, front = 0, timer = 0, clip = null, waiting = false, flip = false;

  function load(item) {
    if (item.src) {
      const img = new Image();
      img.alt = "";
      img.decoding = "async";
      if (at < 0) img.fetchPriority = "high";
      img.src = item.src(width());
      return img.decode().then(() => img, () => null);
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
    const item = list[k];
    if (item.clip && hold()) return show(k + 1);
    const el = await load(item);
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
  reduce.addEventListener?.("change", sync);
  show(0);
}
