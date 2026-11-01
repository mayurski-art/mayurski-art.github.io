// Trollnite: the on-screen moment when you prestige. Prestige is automatic
// at level 69 (progression.js autoPrestige; user, 2026-11-01), so with no
// button to press, this is how you find out: the new badge, big, in the
// middle of the screen, "Prestige N", then it goes on its own. Prestige
// Master (69) gets its own line. Never blocks a click (pointer-events off).

import { prestigeIconSvg, prestigeName } from "./rank-icons.js?v=rk1-or1";

let el = null, timer = 0;

function show({ prestige, master }) {
  if (!(prestige > 0)) return;
  if (!el) {
    el = document.createElement("div");
    el.className = "to-prestige-moment";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    document.body.appendChild(el);
  }
  el.innerHTML = `<div class="to-pm-badge">${prestigeIconSvg(prestige, 112)}</div>`
    + `<small>${master ? "The last one" : "Prestige up"}</small>`
    + `<strong>${prestigeName(prestige)}</strong>`
    + `<p>${master ? "Nothing left to prove. Your level goes back to 1, and everything stays unlocked." : "Back to level 1. Everything you unlocked stays unlocked."}</p>`;
  el.classList.remove("is-on");
  void el.offsetWidth;   // restart the animation on a second prestige
  el.classList.add("is-on");
  clearTimeout(timer);
  timer = setTimeout(() => el.classList.remove("is-on"), 5200);
}

window.addEventListener("trollforces:prestige-auto", (e) => show(e.detail || {}));
