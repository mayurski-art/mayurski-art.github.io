// Troll Forces escape menu: the settings sliders, checks and selects (lobby
// and pause copies kept in step) and the pause menu's player roster.

import { settings, applySettings, saveSettings } from "./settings.js?v=ms1-gj1-fu1b7b7dc2-wb1m1c4-cup1-th2-ar2-cd1-sh1-cl1-bp1-gt1-gt2-cw1-fj1-zr9-zr10-zc1-zc2-hr2-zp1-aa0-dj2-bf1-pl2-pi1-sr1-br1-nf1-fl1-nx1-or1-nf2-nb1-em2-nb2-pc2-cf1-gs2-ci1-fh1-lh1-dl1-ci2-fc1-bj1-ci3-ci4-nk1-nk2-hv1-fm1-mr1-ci5-fg2-wh1-bd1-ht1-mj1-lp1-bw2-rb1-fg3-hd1-rc1-rc2-rc3-rc4-rc5-dom1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-gf1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1-sp1-ch1-chg1-kbt1-gb1-gb2-rh1-ls4-gb4-tb1-gb6-gb8-gb9-pd2-ci6-dm1-pm1-kbk2-zw1-sam1-tfp2-rl1-tfp4-tfp7-tfb8-ss1";
import { PAD_SENS_MULT, PAD_SENS_NAMES } from "../input/gamepad.js?v=in1-fu1b7-wb1-th2-ar1-ar2-cl1-bp1-fj1-zr10-zc1-zc2-zp1-aa0-pd1-nf1-or1-tn1-tn2-dc1-ne1-dc2-dc3-dc4-rf1-ph1-rp2-ls1-rp3-rr1-op1-ld1-an1-rt1-ld2-ld3-na1-na2-fs1-kp1-bl1-rg1-ut1-gf1-tg1-tw1-tcs1-er1-cu1-rb2-rb3-rb4-rb5-rb6-hp1-mh1-ht2-bx1-ba1-sf1-cg1-hl1-mv1-sp1-ch1-chg1-kbt1-gb1-gb2-rh1-ls4-gb4-tb1-gb6-gb8-gb9-pd2-ci6-dm1-pm1-kbk2-zw1-spd1-sam1-tfp2-rl1-tfp4-tfp7-tfb8-ss1";
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
  bindCheck("to-set-fps", "fps");
  bindCheck("to-set-invincible", "invincible");

  bindRange("to-set-volume-lobby", "volume", "to-set-volume-lobby-out");
  bindRange("to-set-ambience-lobby", "ambience", "to-set-ambience-lobby-out");
  bindRange("to-set-sens-lobby", "sens", "to-set-sens-lobby-out", "%");
  bindRange("to-set-fov-lobby", "fov", "to-set-fov-lobby-out", "°");
  bindCheck("to-set-invert-lobby", "invert");
  bindCheck("to-set-minimap-lobby", "minimap");
  bindCheck("to-set-fps-lobby", "fps");
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
