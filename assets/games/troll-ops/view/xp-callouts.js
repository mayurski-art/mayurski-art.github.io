// Troll Forces: what a kill and the XP it pays look like in a match.
//
// A kill is Fortnite's callout (user: "make it look like fornite including
// changing the text"): ELIMINATED and who, white, heavy, upper case, popping
// in under the crosshair. The XP is its own line of bare text at the lower
// centre of the screen, no box (user: "the xp earned can be like i said
// earlier on the lower center of the screen", as the site's XP gains are in
// assets/js/troll-accounts.js): "+10 XP" over what paid it.

import { game } from "../core/state.js?v=st1";

const CALLOUTS_MAX = 3;
const CALLOUT_MS = 2000;
const GAINS_MAX = 3;
const GAIN_MS = 2200;

/* ELIMINATED <name> under the crosshair; the newest at the bottom. */
export function showElimination(name) {
  const root = game.els.xpPopups;
  if (!root) return;
  const div = document.createElement("div");
  div.className = "to-elim";
  const tag = document.createElement("span");
  tag.className = "to-elim-tag";
  tag.textContent = "Eliminated";
  div.appendChild(tag);
  if (name) {
    const who = document.createElement("b");
    who.className = "to-elim-name";
    who.textContent = name;
    div.appendChild(who);
  }
  root.appendChild(div);
  while (root.children.length > CALLOUTS_MAX) root.firstChild.remove();
  setTimeout(() => div.remove(), CALLOUT_MS);
}

/* "+N XP" over its reason, lower centre, rising and fading. */
export function showXpGain(amount, label) {
  const root = gainsRoot();
  if (!root) return;
  const div = document.createElement("div");
  div.className = "to-xp-gain";
  const n = document.createElement("strong");
  n.textContent = `+${amount} XP`;
  div.appendChild(n);
  if (label) {
    const why = document.createElement("span");
    why.textContent = label;
    div.appendChild(why);
  }
  root.appendChild(div);
  while (root.children.length > GAINS_MAX) root.firstChild.remove();
  setTimeout(() => div.remove(), GAIN_MS);
}

function gainsRoot() {
  let root = document.getElementById("to-xp-gains");
  if (root) return root;
  const hud = game.els.hud;
  if (!hud) return null;
  root = document.createElement("div");
  root.className = "to-xp-gains";
  root.id = "to-xp-gains";
  root.setAttribute("aria-hidden", "true");
  hud.appendChild(root);
  return root;
}
