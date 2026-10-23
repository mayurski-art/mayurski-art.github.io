// Carrying your class's perks into a life (perks.js has the list and the
// numbers). On every spawn, the active class's three become the ones you
// carry (a class change from the pause menu lands here, never mid-life),
// the ones other players have to know about go out on the wire (net.perks,
// sent as `pk`), and BO2's spawn card shows the class and its perks.

import { game } from "../core/state.js?v=st1";
import { weaponForMode } from "../modes/modes.js?v=umb1-rn-wst-tl1-bs1-soc1-t69-u69b7b7d-wb1-ar1-ar2-zh1-fl1-or1-ffa1-dom1-gf1-tg1-kb9-sp1";
import { PERK_DEFS, PERK_TIER_COLORS, setCarriedPerks, carriedPerks, perkBits, perkIconSvg } from "../progression/perks.js?v=pk1-cl1-bp1-fj1-zc1-zc2-nf1-or1";

/* A class picked from the pause menu, waiting for the next respawn
   (null when there is none). */
export const classSwitch = { pending: null };

/* Modes where you carry your own class: not the ones that hand you the gun
   (Gun Game, One in the Chamber), Royale (loot only) or Socialize. */
export function classAllowed(mode) {
  return !!mode && !mode.royale && !mode.social && !weaponForMode(mode);
}

export function carryClassPerks({ card = true } = {}) {
  const mode = game.currentMode?.();
  const L = game.loadout;
  setCarriedPerks(classAllowed(mode) && L ? L.classPerks : []);
  if (game.net) game.net.perks = perkBits();
  if (card) showPerkCard();
}

/* Out of a match: nothing carried. */
export function dropPerks() {
  clearTimeout(cardT);
  cardEl?.classList.remove("is-visible");
  setCarriedPerks([]);
  classSwitch.pending = null;
  if (game.net) game.net.perks = 0;
}

let cardEl = null, cardT = 0;
function showPerkCard() {
  const ids = carriedPerks();
  const hud = game.els?.hud;
  if (!hud) return;
  if (!cardEl) {
    cardEl = document.createElement("div");
    cardEl.className = "to-perk-card";
    cardEl.setAttribute("aria-live", "polite");
    hud.appendChild(cardEl);
  }
  clearTimeout(cardT);
  if (!ids.length) { cardEl.classList.remove("is-visible"); return; }
  // Not under the pre-match countdown or the loading screen: it shows when
  // the match goes live (dropPerks cancels it if the match is left first).
  if (game.isStaging?.() || game.gameState !== "playing") { cardT = setTimeout(showPerkCard, 250); return; }
  cardEl.innerHTML = "";
  const name = document.createElement("b");
  name.textContent = game.loadout?.className || "";
  cardEl.appendChild(name);
  const row = document.createElement("div");
  for (const id of ids) {
    const def = PERK_DEFS[id];
    const p = document.createElement("span");
    p.style.setProperty("--perk", PERK_TIER_COLORS[def.tier]);
    p.innerHTML = perkIconSvg(id);
    p.append(def.short || def.name);
    row.appendChild(p);
  }
  cardEl.appendChild(row);
  cardEl.classList.add("is-visible");
  cardT = setTimeout(() => cardEl.classList.remove("is-visible"), 3000);
}
