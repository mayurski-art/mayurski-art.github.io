/* I'M NEW HERE (user, 2026-10-30: "neat and simple"): the Play page's
   tutorial. One sheet, four pages: the modes, the controls (keyboard and
   mouse, controller, touch), the Locker, and the rest a new troll needs.
   lobby-fn.js mounts it and hands it the pad; like lobby-fn it imports
   nothing and holds no game state.

   The copy is the game's own: the modes from modes/modes.js and
   menu/mode-picker.js, the keys from input/keyboard-mouse.js and
   view/player-update.js, the pad from input/gamepad.js (BO2's Xbox 360
   layout), the touch buttons from troll-ops.html (their icons are cloned
   from the buttons themselves), the Locker from menu-bo2.js. Change one of
   those and change its line here.

   The two pictures (ui/new-here/) are rendered from the game by
   tools/troll-ops-new-here-art.mjs: a Test Range match on a phone, and
   the Locker. */

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const ART = "assets/games/troll-ops/ui/new-here";
const ART_V = "nh1";   // bump when the pictures are re-rendered (same names)
const pic = (name, alt) => `<figure class="to-nh-pic"><img alt="${esc(alt)}" loading="lazy" decoding="async"
  src="${ART}/${name}-960.webp?v=${ART_V}" srcset="${ART}/${name}-960.webp?v=${ART_V} 960w, ${ART}/${name}-1600.webp?v=${ART_V} 1600w" sizes="(max-width: 700px) 100vw, 640px"></figure>`;

/* Keys as caps: "W A S D" is four caps, "Shift" one; " | " between two
   that do the same thing ("or"), " / " between a row of keys that each do
   the next thing in the line ("1 / 2 / 3": primary, secondary, melee). */
const cap = (k) => (/^(\S )+\S$/.test(k) ? k.split(" ") : [k]).map((x) => `<kbd>${esc(x)}</kbd>`).join("");
const caps = (s) => s.split(" | ").map((alt) => alt.split(" / ").map(cap).join("<i>/</i>")).join("<i>or</i>");
const rows = (list) => `<dl class="to-nh-keys">${list.map(([k, what]) => `<div><dt>${caps(k)}</dt><dd>${what}</dd></div>`).join("")}</dl>`;

const MODES = [
  ["Troll Royale", "A hundred trolls, one floating island. Land with a pistol, loot the rest, stay out of the Cringe. Solo, Duo, Trio or Squad, on Trollface Island or Hollowgrin underneath it."],
  ["Public Match", "Versus with whoever's online, bots in the gaps. Vote on the map with the lobby."],
  ["Socialize", "No guns. Troll City, Kabukigrin, Troll Beach or Undergrin: emotes, chat, courts, waves."],
  ["Zombies", "The hub: step on a map's pad and up to four of you take on the horde. Credits buy guns at the kiosk."],
  ["Solo Play", "Ops (waves of grunts), Zombies on your own, or the Test Range to sort out your sensitivity."],
  ["Private Match", "Make a room code, send it to your friends, play any versus mode. Nobody else gets in."],
];
const VERSUS = [
  ["Team Deathmatch", "Trolls against Jeets. First side to 69 kills."],
  ["Free-for-All", "Every troll for themselves. First to 30."],
  ["Domination", "Three flags. Hold them, score. First side to 200."],
  ["King of the Hill", "One ring that moves every 45 seconds. Stand in it."],
  ["Search & Destroy", "One life a round. Trolls plant, Jeets defuse. First to 6."],
  ["Infection", "One of you starts infected and it spreads. Survive three minutes."],
  ["One in the Chamber", "One bullet. Hit and you get it back; miss and good luck."],
  ["Gun Game", "Every kill moves you up the rack. Clear it to win."],
  ["U Mad Bro?", "Free-for-all where bodies fly and kills go BONK. Opens at Prestige 2."],
];

const KBM = [
  ["W A S D", "Move"],
  ["Mouse", "Look"],
  ["Left click", "Shoot"],
  ["Right click | Q", "Aim down sights"],
  ["Space", "Jump"],
  ["Shift", "Sprint"],
  ["C", "Crouch. Sprinting, it's a slide"],
  ["Ctrl", "Dive"],
  ["R", "Reload"],
  ["X", "Hold to pick up, open, plant or defuse"],
  ["1 / 2 / 3", "Primary, secondary, melee"],
  ["V", "Quick melee"],
  ["G", "Throw what you brought (hold to cook)"],
  ["F", "Tactical"],
  ["4 / 5 / 6 / 7", "Call a scorestreak. In Royale: 4 plates up, 5 Hopium"],
  ["E", "Hero ability"],
  ["B", "First or third person (hold Alt to look round yourself)"],
  ["T", "Admire your gun"],
  ["H", "Emotes"],
  ["Tab", "Scoreboard"],
  ["Enter / Y / U", "Chat: everyone, your team, the public room"],
  ["Esc", "Pause and settings"],
];
const PAD = [
  ["Left stick", "Move. Click it (L3) to sprint"],
  ["Right stick", "Look. Click it (R3) to melee"],
  ["RT", "Shoot"],
  ["LT", "Aim down sights"],
  ["A", "Jump"],
  ["B", "Crouch or slide"],
  ["X", "Reload. Hold to pick up, open, plant or defuse"],
  ["Y", "Switch weapon"],
  ["LB / RB", "Tactical, lethal"],
  ["D-pad up / D-pad down", "Pick a scorestreak (Royale: plate, Hopium)"],
  ["D-pad right", "Call it"],
  ["D-pad left", "Tap to admire your gun, hold for emotes"],
  ["View", "First or third person (hold to look round yourself)"],
  ["Start", "Pause"],
];
/* The touch buttons, by their id in troll-ops.html (#to-touch-<id>). */
const TOUCH = [
  ["move", "Left thumb anywhere on the left: move. All the way up sprints"],
  ["look", "Right thumb anywhere on the right: look"],
  ["fire", "Fire. Keep your thumb on it and drag to aim"],
  ["ads", "Aim down sights (a tap toggles it)"],
  ["jump", "Jump"],
  ["slide", "Crouch, hold to go prone, slide while sprinting"],
  ["reload", "Reload"],
  ["swap", "Swap weapons. Hold it to pick up or open things"],
  ["melee", "Melee (it shows your melee weapon)"],
  ["nade", "Your throwable, lethal or tactical (it shows what you carry and how many). Hold to cook"],
  ["pov", "First or third person"],
  ["free", "Third person: tap, then drag to look round yourself"],
  ["emote", "Emotes"],
  ["admire", "Admire your gun"],
];
const touchIcon = (id) => {
  if (id === "move" || id === "look") return `<span class="to-nh-ticon is-${id}" aria-hidden="true"></span>`;
  const b = document.getElementById(`to-touch-${id}`);
  const svg = b?.querySelector("svg");
  return `<span class="to-nh-ticon" aria-hidden="true">${svg ? svg.outerHTML : esc(b?.textContent.trim() || "")}</span>`;
};

const PAGES = [
  { id: "modes", tab: "Modes", title: "What to play",
    body: () => `
      <p class="to-nh-lead">Pick one with <b>Change mode</b> on the Play page, or <b>All modes</b> at the bottom. Then hit <b>PLAY</b>.</p>
      <ul class="to-nh-list">${MODES.map(([n, d]) => `<li><b>${esc(n)}</b><span>${esc(d)}</span></li>`).join("")}</ul>
      <h3>Versus modes</h3>
      <p class="to-nh-lead">Public and Private Match play these. Pick one on PLAY's screen.</p>
      <ul class="to-nh-list is-tight">${VERSUS.map(([n, d]) => `<li><b>${esc(n)}</b><span>${esc(d)}</span></li>`).join("")}</ul>` },
  { id: "controls", tab: "Controls", title: "How to move",
    body: () => `
      <div class="to-nh-seg" role="tablist" aria-label="Your controls">
        <kbd class="to-fn-padkey" aria-hidden="true">X</kbd>
        <button type="button" role="tab" data-in="kbm" id="to-nh-in-kbm" aria-controls="to-nh-kbm">Keyboard &amp; mouse</button>
        <button type="button" role="tab" data-in="pad" id="to-nh-in-pad" aria-controls="to-nh-pad">Controller</button>
        <button type="button" role="tab" data-in="touch" id="to-nh-in-touch" aria-controls="to-nh-touch">Touch</button>
      </div>
      <div class="to-nh-in" id="to-nh-kbm" role="tabpanel" aria-labelledby="to-nh-in-kbm">${rows(KBM)}
        <p class="to-nh-note">Sensitivity, FOV and invert are in Options. The Test Range lets you nudge them live with - = [ ].</p></div>
      <div class="to-nh-in" id="to-nh-pad" role="tabpanel" aria-labelledby="to-nh-in-pad">${rows(PAD)}
        <p class="to-nh-note">Black Ops 2's layout, Xbox names (PlayStation: A is ✕, B ○, X □, Y △, LB/RB L1/R1, LT/RT L2/R2). Options draws your pad and lets you move the emote button. In menus: LB/RB change tabs, A picks, B goes back.</p></div>
      <div class="to-nh-in" id="to-nh-touch" role="tabpanel" aria-labelledby="to-nh-in-touch">
        ${pic("touch-hud", "A Test Range match on a phone: the move stick bottom left, the fire, aim, jump and other buttons on the right")}
        <ul class="to-nh-touch">${TOUCH.map(([id, what]) => `<li>${touchIcon(id)}<span>${esc(what)}</span></li>`).join("")}</ul>
        <p class="to-nh-note">Options, HUD layout moves any of them. Turn your phone sideways to play.</p></div>` },
  { id: "locker", tab: "Locker", title: "Make it yours",
    body: () => `
      ${pic("locker", "The Locker: your class's slots on the left, your troll in the middle, your look on the right")}
      <p class="to-nh-lead">Everything lives in the <b>Locker</b> tab at the top (LB/RB on a pad). Your class on the left, your look on the right.</p>
      <ul class="to-nh-list">
        <li><b>Classes</b><span>Five of them. Each has a primary, a secondary, attachments, a melee, one throwable, three perks and three scorestreaks. Rename them too.</span></li>
        <li><b>Attachments and camos</b><span>Primary, then Attachments: optic, barrel, underbarrel, ammo and skin. Camos open as you level that gun; prestige finishes at their prestige.</span></li>
        <li><b>Your troll</b><span>Face (the expression everyone sees), Wrist, and Body if you hold a TROLLS NFT. Plus your reticle and calling card.</span></li>
        <li><b>Barracks</b><span>The Career tab, or your picture top right: profile picture, clan tag, combat record, prestige rewards.</span></li>
      </ul>
      <p class="to-nh-note">Sign in to keep your card, your challenges and your XP. Guests can play everything, they just don't keep it.</p>` },
  { id: "more", tab: "The rest", title: "Good to know",
    body: () => `
      <ul class="to-nh-list">
        <li><b>Levels and prestige</b><span>Matches give XP. Hit level 69, then Prestige in the Career tab: back to level 1 with a new badge. Ten of those and you're Prestige Master. Some modes and finishes only open at a prestige.</span></li>
        <li><b>Scorestreaks</b><span>Pick three in your class. Kills, assists and objectives fill the meter; call one with 4 to 7, d-pad right, or its button. Royale and U Mad Bro? have none.</span></li>
        <li><b>Challenges</b><span>The Quests tab. Do them, flex them.</span></li>
        <li><b>Your party</b><span>The + pads beside you, or N Online at the bottom: invite people, then play together. Your leader presses PLAY.</span></li>
        <li><b>Socialize</b><span>Nobody shoots. Emote (H, d-pad left held, or the Emote button), chat, hoop, surf, ride.</span></li>
        <li><b>Settings</b><span>Options: sensitivity, FOV, graphics, HUD layout. Slow laptop? Turn Animations off.</span></li>
      </ul>
      <p class="to-nh-lead is-end">That's it. Go troll somebody.</p>` },
];

export function mountNewHere(root) {
  const sheet = document.createElement("section");
  sheet.className = "to-nh";
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  sheet.setAttribute("aria-labelledby", "to-nh-title");
  sheet.hidden = true;
  sheet.innerHTML = `
    <div class="to-nh-card">
      <header class="to-nh-head">
        <h2 id="to-nh-title">New here?<small>The basics in four pages</small></h2>
        <button type="button" class="to-fn-glass to-nh-x" aria-label="Close the tutorial"><kbd class="to-fn-padkey" aria-hidden="true">B</kbd><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      </header>
      <nav class="to-nh-tabs" role="tablist" aria-label="Tutorial pages">
        <kbd class="to-fn-padkey" aria-hidden="true">LB</kbd>
        ${PAGES.map((p, i) => `<button type="button" role="tab" class="to-nh-tab" id="to-nh-tab-${p.id}" data-i="${i}" aria-controls="to-nh-page-${p.id}"><em aria-hidden="true">${i + 1}</em>${esc(p.tab)}</button>`).join("")}
        <kbd class="to-fn-padkey" aria-hidden="true">RB</kbd>
      </nav>
      <div class="to-nh-body">${PAGES.map((p) => `<article class="to-nh-page" id="to-nh-page-${p.id}" role="tabpanel" aria-labelledby="to-nh-tab-${p.id}" tabindex="0" hidden><h3 class="to-nh-h">${esc(p.title)}</h3>${p.body()}</article>`).join("")}</div>
      <footer class="to-nh-foot">
        <button type="button" class="to-nh-step" data-step="-1">Back</button>
        <span class="to-nh-count" aria-live="polite"></span>
        <button type="button" class="to-nh-step is-next" data-step="1">Next</button>
      </footer>
    </div>`;
  root.appendChild(sheet);

  const $ = (s) => sheet.querySelector(s), $$ = (s) => [...sheet.querySelectorAll(s)];
  const tabs = $$(".to-nh-tab"), pages = $$(".to-nh-page"), body = $(".to-nh-body");
  let at = 0, opener = null, input = "kbm";

  function setInput(id) {
    input = id;
    for (const b of $$("[data-in]")) {
      const on = b.dataset.in === id;
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
      b.classList.toggle("is-on", on);
    }
    for (const p of $$(".to-nh-in")) p.hidden = p.id !== `to-nh-${id}`;
  }
  function show(i, focusTab = false) {
    at = (i + PAGES.length) % PAGES.length;
    tabs.forEach((t, k) => {
      const on = k === at;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      t.classList.toggle("is-on", on);
    });
    pages.forEach((p, k) => { p.hidden = k !== at; });
    body.scrollTop = 0;
    $(".to-nh-count").textContent = `${at + 1} of ${PAGES.length}`;
    $('[data-step="-1"]').disabled = at === 0;
    $(".to-nh-step.is-next").textContent = at === PAGES.length - 1 ? "Let's go" : "Next";
    if (focusTab) tabs[at].focus();
  }
  function open(page = 0) {
    if (!sheet.hidden) return show(page, true);
    opener = document.activeElement;
    // the controls you're holding first: a pad, a touch screen, else the keys
    setInput(root.classList.contains("has-pad") ? "pad" : matchMedia("(pointer: coarse)").matches ? "touch" : "kbm");
    sheet.hidden = false;
    root.classList.add("is-nh");
    show(page, true);
  }
  function close() {
    if (sheet.hidden) return;
    sheet.hidden = true;
    root.classList.remove("is-nh");
    (opener && opener.isConnected ? opener : root.querySelector(".to-fn-newhere"))?.focus?.();
  }

  for (const t of tabs) t.addEventListener("click", () => show(+t.dataset.i));
  $(".to-nh-x").addEventListener("click", close);
  for (const b of $$(".to-nh-step")) b.addEventListener("click", () => {
    if (+b.dataset.step > 0 && at === PAGES.length - 1) return close();
    show(at + +b.dataset.step);
  });
  for (const b of $$("[data-in]")) b.addEventListener("click", () => setInput(b.dataset.in));
  // the backdrop round the card closes it
  sheet.addEventListener("click", (e) => { if (e.target === sheet) close(); });

  /* Keys, while it's up: nothing gets past to the lobby or the game (H would
     open the emote wheel behind it). Esc closes; Left / Right turn pages
     (or, on the controls' own row, change input); Tab stays inside. */
  document.addEventListener("keydown", (e) => {
    if (sheet.hidden) return;
    e.stopImmediatePropagation();
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const d = e.key === "ArrowRight" ? 1 : -1;
      const seg = e.target.closest?.("[data-in]");
      if (seg) {
        const ids = ["kbm", "pad", "touch"];
        setInput(ids[(ids.indexOf(input) + d + 3) % 3]);
        $(`[data-in="${input}"]`).focus();
      } else show(at + d, !!e.target.closest?.(".to-nh-tab"));
      return;
    }
    if (e.key === "Tab") {
      const all = $$("button:not(:disabled), [tabindex='0']").filter((x) => x.offsetParent && x.tabIndex >= 0);
      const first = all[0], last = all[all.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }, true);

  // swipe the page left / right for the next / last
  {
    let x0 = null, y0 = 0;
    body.addEventListener("pointerdown", (e) => { x0 = e.clientX; y0 = e.clientY; });
    body.addEventListener("pointerup", (e) => {
      if (x0 == null) return;
      const dx = e.clientX - x0, dy = e.clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > 1.5 * Math.abs(dy)) show(at + (dx < 0 ? 1 : -1));
    });
    body.addEventListener("pointercancel", () => { x0 = null; });
  }

  /* A controller (lobby-fn.js's poll hands its presses here while the sheet
     is up): LB / RB or left / right turn pages, up / down scroll, A presses
     what's focused, B closes, X changes the controls shown. */
  function padPress(i) {
    if (i === 4 || i === 5) show(at + (i === 5 ? 1 : -1), true);
    else if (i === 1) close();
    else if (i === 2 && PAGES[at].id === "controls") { const ids = ["kbm", "pad", "touch"]; setInput(ids[(ids.indexOf(input) + 1) % 3]); }
    else if (i === 0) { const a = document.activeElement; if (a && sheet.contains(a) && a.tagName === "BUTTON") a.click(); else show(at + 1, true); }
  }
  function padMove(d) {
    if (d === "left" || d === "right") show(at + (d === "right" ? 1 : -1), true);
    else body.scrollBy({ top: d === "down" ? 140 : -140, behavior: "smooth" });
  }

  return { open, close, isOpen: () => !sheet.hidden, page: () => PAGES[at].id, input: () => input, setInput, show, padPress, padMove, pages: PAGES.map((p) => p.id) };
}
