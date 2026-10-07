// Troll Forces mode picker: the Play tab's mode list, prestige locks and the
// per-mode lobby state (streak picker, forced map, map pool).

import { MODES, MODE_IDS } from "../modes.js?v=umb1-rn-wst-tl1-bs1-soc1-t69-u69b7";
import { prestigeUnlocked } from "../progression.js?v=p5-wst-sb2-fu1";
import { streaksAllowed } from "../scorestreaks.js?v=umb1-wst-sb2-fu1";
import { game } from "../core/state.js?v=st1";

/* The Play tab's mode list: versus modes first, then the solo ones, each a
   full-width row with a tick on the one you're deploying into. */
const MODE_GROUPS = [
  { label: "Versus", ids: ["tdm", "koth", "snd", "infection", "oitc", "gungame", "umb"] },
  { label: "Solo", ids: ["ops", "zombies", "range"] },
  // Its own group so it stays out of the Versus list (the BO2 menu reads
  // the group headings: Socialize is its own main-menu entry).
  { label: "Social", ids: ["social"] },
];
const TICK_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

export function buildModeButtons() {
  game.els.loMode.innerHTML = "";
  // Anything added to modes.js later still shows up, under Versus or Solo.
  const placed = new Set(MODE_GROUPS.flatMap((g) => g.ids));
  const groups = MODE_GROUPS.map((g) => ({ ...g, ids: g.ids.filter((id) => MODES[id]) }));
  for (const id of MODE_IDS) {
    if (!placed.has(id) && !MODES[id].hidden) groups[MODES[id].pvp ? 0 : 1].ids.push(id);
  }
  for (const g of groups) {
    const head = document.createElement("div");
    head.className = "to-lo-modegroup";
    head.textContent = g.label;
    game.els.loMode.appendChild(head);
    for (const id of g.ids) {
      const m = MODES[id];
      const b = document.createElement("button");
      b.type = "button";
      b.className = "to-lo-modebtn";
      b.dataset.mode = id;
      b.title = m.blurb;
      const name = document.createElement("span");
      name.textContent = m.name;
      b.appendChild(name);
      b.insertAdjacentHTML("beforeend", TICK_SVG);
      b.addEventListener("click", () => { if (modeLocked(m)) return; game.modeId = id; game.modePicked = true; renderModes(); });
      game.els.loMode.appendChild(b);
    }
  }
  renderModes();
}

/* The mode description is the one optional thing in the mode column: drop
   it when the column is too short for it, so the mode buttons always fit
   with no scrollbar (the column stops above the map card). */
let modeColumn;
function fitModeBlurb() {
  if (!modeColumn) return;
  game.els.loModeBlurb.hidden = false;
  if (modeColumn.scrollHeight > modeColumn.clientHeight + 1) game.els.loModeBlurb.hidden = true;
}

/* A prestige-gated mode (U Mad Bro?, Prestige 2) shows locked until then:
   disabled, with the requirement in its title and data-lock. The BO2 menu
   reads both off the button. */
// Localhost (development) skips the lock so the mode can be played and tested
// without a signed-in Prestige 2 account; the live site keeps it.
const DEV_HOST = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
const modeLocked = (m) => !!m?.prestige && !DEV_HOST && !prestigeUnlocked(m.prestige);

export function renderModes() {
  // Picked, then the lock came back (signed out): fall back to TDM.
  if (game.modePicked && modeLocked(game.currentMode())) game.modeId = "tdm";
  for (const b of game.els.loMode.children) {
    if (!b.dataset.mode) continue;
    const m = MODES[b.dataset.mode];
    const locked = modeLocked(m);
    b.disabled = locked;
    b.classList.toggle("is-locked", locked);
    b.dataset.lock = locked ? `Prestige ${m.prestige}` : "";
    b.title = locked ? `Unlocks at Prestige ${m.prestige}. ${m.blurb}` : m.blurb;
    const on = game.modePicked && b.dataset.mode === game.modeId;
    b.classList.toggle("is-active", on);
    b.setAttribute("aria-pressed", String(on));
  }
  game.els.loModeBlurb.textContent = game.modePicked ? game.currentMode().blurb : "Pick a mode to deploy.";
  game.els.startBtn.disabled = !game.modePicked;
  fitModeBlurb();
  // On phones the list is one sideways-scrolling row of chips; keep the
  // picked one in view.
  const act = game.els.loMode.querySelector(".to-lo-modebtn.is-active");
  if (act && game.els.loMode.scrollWidth > game.els.loMode.clientWidth) {
    const box = game.els.loMode.getBoundingClientRect();
    const r = act.getBoundingClientRect();
    if (r.left < box.left || r.right > box.right) {
      game.els.loMode.scrollLeft += r.left - box.left - 16;
    }
  }
  game.els.loPvp.hidden = !game.modePicked || !game.isPvp();
  const soloNote = document.getElementById("to-pf-solo-note");
  if (soloNote) soloNote.hidden = !game.modePicked || game.isPvp();

  // Scorestreaks are versus-only, and Gun Game / One in the Chamber opt out
  // (see modes.js noStreaks). The picker stays reachable either way so the
  // note can explain why it's empty, rather than the tab vanishing. Until a
  // mode is picked (phones start with none) the picker shows: the streaks
  // you choose carry into any versus match.
  const allowed = !game.modePicked || streaksAllowed(game.currentMode());
  const ssPanelNote = document.getElementById("to-ss-note");
  const ssSoloNote = document.getElementById("to-ss-solo-note");
  if (ssPanelNote) ssPanelNote.hidden = !allowed;
  if (ssSoloNote) ssSoloNote.hidden = allowed;
  if (game.els.ssPicker) game.els.ssPicker.hidden = !allowed;
  // Zombies and the range bring their own map, so the card just names it.
  game.loadout.setForcedMap(game.currentMode().forceMap || null);
  game.loadout.setMapPool(game.currentMode().mapPool || null);
  game.loadout.setMapAllow(game.currentMode().maps || null);
  game.renderLobbyRoster();   // no-ops until the lobby is ready
  if (game.lobbyReady) game.refreshLobbyMap();
}

/* What used to run at load in game.js: called from game.js where this code was. */
export function initModePicker() {
  /* The mode description is the one optional thing in the mode column: drop
     it when the column is too short for it, so the mode buttons always fit
     with no scrollbar (the column stops above the map card). */
  modeColumn = game.els.loMode.closest(".to-pf-modes");
  if (modeColumn && "ResizeObserver" in window) new ResizeObserver(fitModeBlurb).observe(modeColumn);
}
