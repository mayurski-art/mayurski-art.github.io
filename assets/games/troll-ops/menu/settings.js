// Troll Forces settings: the saved settings object and applySettings, which
// pushes it into audio, FOV, the minimap, graphics and the bot skill.

import { minimapCanvas } from "../core/minimap.js?v=cr1-gj1-fu1b7b7dc2-wb1";
import { game } from "../core/state.js?v=st1";

export const SETTINGS_KEY = "trollops:settings";
export const settings = {
  volume: 50, ambience: 60, sens: 100, padSens: 3, fov: 78, invert: false, minimap: true, botSkill: "regular", aimAssist: true, thirdPerson: false,
  gfx: "auto", viewMode: false, invincible: false,
  ...(() => { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch { return {}; } })(),
};

export function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* private mode */ }
}

export function applySettings() {
  game.audio.setVolume(settings.volume / 100);
  game.ambience.setLevel(settings.ambience / 100);
  game.baseFov = settings.fov;
  minimapCanvas.hidden = !settings.minimap;

  const set = (id, value, outId, suffix = "") => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.type === "checkbox") el.checked = !!value;
    else el.value = value;
    const out = outId && document.getElementById(outId);
    if (out) out.textContent = `${value}${suffix}`;
  };
  set("to-set-volume", settings.volume, "to-set-volume-out");
  set("to-set-ambience", settings.ambience, "to-set-ambience-out");
  set("to-set-sens", settings.sens, "to-set-sens-out", "%");
  set("to-set-padsens", settings.padSens);
  set("to-set-padsens-lobby", settings.padSens);
  set("to-set-fov",settings.fov, "to-set-fov-out", "°");
  set("to-set-invert", settings.invert);
  set("to-set-minimap", settings.minimap);
  set("to-set-aimassist", settings.aimAssist);

  set("to-set-volume-lobby", settings.volume, "to-set-volume-lobby-out");
  set("to-set-ambience-lobby", settings.ambience, "to-set-ambience-lobby-out");
  set("to-set-sens-lobby", settings.sens, "to-set-sens-lobby-out", "%");
  set("to-set-fov-lobby", settings.fov, "to-set-fov-lobby-out", "°");
  set("to-set-invert-lobby", settings.invert);
  set("to-set-minimap-lobby", settings.minimap);
  set("to-set-aimassist-lobby", settings.aimAssist);
  set("to-set-viewmode-lobby", settings.viewMode);
  set("to-set-invincible", settings.invincible);
  game.renderViewModeRow();
  set("to-set-botskill", settings.botSkill);
  set("to-set-gfx", settings.gfx);
  set("to-set-gfx-lobby", settings.gfx);
  game.applyGraphics();
  // Takes effect for bots created from here on, so a change mid-match applies
  // as they respawn rather than rewriting the ones already in the fight.
  game.bots.difficulty = settings.botSkill;
  game.renderBotSkillNote();
}
