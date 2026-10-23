// Troll Forces settings: the saved settings object and applySettings, which
// pushes it into audio, FOV, the minimap, graphics and the bot skill.

import { minimapCanvas } from "../core/minimap.js?v=cr1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ms1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-gf1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1-sp1-ch1-chg1-kbt1-gb1-gb2-rh1-ls4";
import { game } from "../core/state.js?v=st1";
import { showFps } from "../core/fps-meter.js?v=fp1-zr10";

export const SETTINGS_KEY = "trollops:settings";
export const settings = {
  volume: 50, ambience: 60, sens: 100, padSens: 3, fov: 78, invert: false, minimap: true, botSkill: "regular", thirdPerson: false,
  gfx: "auto", viewMode: false, invincible: false, fps: false,
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
  set("to-set-fps", settings.fps);

  set("to-set-volume-lobby", settings.volume, "to-set-volume-lobby-out");
  set("to-set-ambience-lobby", settings.ambience, "to-set-ambience-lobby-out");
  set("to-set-sens-lobby", settings.sens, "to-set-sens-lobby-out", "%");
  set("to-set-fov-lobby", settings.fov, "to-set-fov-lobby-out", "°");
  set("to-set-invert-lobby", settings.invert);
  set("to-set-minimap-lobby", settings.minimap);
  set("to-set-fps-lobby", settings.fps);
  set("to-set-viewmode-lobby", settings.viewMode);
  set("to-set-invincible", settings.invincible);
  game.renderViewModeRow();
  set("to-set-botskill", settings.botSkill);
  set("to-set-gfx", settings.gfx);
  set("to-set-gfx-lobby", settings.gfx);
  game.applyGraphics();
  showFps(settings.fps);
  // Takes effect for bots created from here on, so a change mid-match applies
  // as they respawn rather than rewriting the ones already in the fight.
  game.bots.difficulty = settings.botSkill;
  game.renderBotSkillNote();
}
