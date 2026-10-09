// Troll Forces escape menu: the settings sliders, checks and selects (lobby
// and pause copies kept in step) and the pause menu's player roster.

import { settings, applySettings, saveSettings } from "./settings.js?v=ms1-gj1-fu1b7b7dc2-wb1m1c4-cup1";
import { PAD_SENS_MULT, PAD_SENS_NAMES } from "../input/gamepad.js?v=in1-fu1b7-wb1";
import { game } from "../core/state.js?v=st1";

function bindRange(id, key, outId, suffix = "") {
  const el = document.getElementById(id);
  el?.addEventListener("input", () => {
    settings[key] = Number(el.value);
    const out = document.getElementById(outId);
    if (out) out.textContent = `${el.value}${suffix}`;
    applySettings();
    saveSettings();
  });
}

function bindCheck(id, key) {
  const el = document.getElementById(id);
  el?.addEventListener("change", () => {
    settings[key] = el.checked;
    applySettings();
    saveSettings();
  });
}

function bindSelect(id, key) {
  const el = document.getElementById(id);
  el?.addEventListener("change", () => {
    settings[key] = el.value;
    applySettings();
    saveSettings();
  });
}

// Same settings, reachable from both the in-match Esc menu and the lobby's
// Controls tab — a player shouldn't have to deploy just to fix sensitivity.
export function initEscapeMenu() {
  // Stick sensitivity runs BO2's 1–14 ladder, its named steps included.
  for (const id of ["to-set-padsens", "to-set-padsens-lobby"]) {
    const sel = document.getElementById(id);
    if (!sel) continue;
    PAD_SENS_MULT.forEach((_, i) => {
      const n = i + 1;
      sel.add(new Option(PAD_SENS_NAMES[n] ? `${n} (${PAD_SENS_NAMES[n]})` : String(n), String(n)));
    });
    sel.value = String(settings.padSens);
    sel.addEventListener("change", () => {
      settings.padSens = Number(sel.value);
      applySettings();
      saveSettings();
    });
  }
  bindRange("to-set-volume", "volume", "to-set-volume-out");
  bindRange("to-set-ambience", "ambience", "to-set-ambience-out");
  bindRange("to-set-sens", "sens", "to-set-sens-out", "%");
  bindRange("to-set-fov", "fov", "to-set-fov-out", "°");
  bindCheck("to-set-invert", "invert");
  bindCheck("to-set-minimap", "minimap");
  bindCheck("to-set-aimassist", "aimAssist");
  bindCheck("to-set-invincible", "invincible");

  bindRange("to-set-volume-lobby", "volume", "to-set-volume-lobby-out");
  bindRange("to-set-ambience-lobby", "ambience", "to-set-ambience-lobby-out");
  bindRange("to-set-sens-lobby", "sens", "to-set-sens-lobby-out", "%");
  bindRange("to-set-fov-lobby", "fov", "to-set-fov-lobby-out", "°");
  bindCheck("to-set-invert-lobby", "invert");
  bindCheck("to-set-minimap-lobby", "minimap");
  bindCheck("to-set-aimassist-lobby", "aimAssist");
  bindCheck("to-set-viewmode-lobby", "viewMode");
  bindSelect("to-set-botskill", "botSkill");
  bindSelect("to-set-gfx", "gfx");
  bindSelect("to-set-gfx-lobby", "gfx");

  const tabs = document.getElementById("to-menu-tabs");
  tabs?.addEventListener("click", (e) => {
    const btn = e.target.closest(".to-menu-tab");
    if (!btn) return;
    for (const b of tabs.children) {
      const on = b === btn;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", String(on));
    }
    for (const name of ["settings", "controls", "players"]) {
      const panel = document.getElementById(`to-panel-${name}`);
      if (panel) panel.hidden = name !== btn.dataset.tab;
    }
    if (btn.dataset.tab === "players") renderMenuRoster();
  });

  // Touch has no Esc key, so the in-match button opens the same menu.
  document.getElementById("to-gear")?.addEventListener("click", () => {
    if (game.gameState !== "playing") return;
    if (game.controls.isLocked) game.controls.unlock();
    else game.openPauseMenu();
  });
}

export function renderMenuRoster() {
  const box = document.getElementById("to-menu-roster");
  if (!box) return;
  if (!game.isPvp() || !game.net.connected) {
    box.textContent = "Solo run — no other operators.";
    return;
  }
  game.renderScoreboard();
  box.innerHTML = game.els.scoreboard.innerHTML;
}

/* What used to run at load in game.js: called from game.js where this code was. */
export function initMenuRoster() {
  document.getElementById("to-menu-roster")?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-uid]");
    if (b) game.openPlayerProfile(b.dataset.uid);
  });
}
