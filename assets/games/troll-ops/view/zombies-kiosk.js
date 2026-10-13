// Troll Forces Zombies hub: the Weapons and Classes kiosk screens (Zombie
// Rush P6), PLACEHOLDERS for now (user 2026-10-13: "just placeholders").
//
// Laid out like Zombie Rush's (refs/zombie-rush/hub-weapons-kiosk.png,
// hub-classes-kiosk.png): a tier row and gun cards for Weapons, kit cards for
// Classes, your Credits up top. Nothing can be bought yet: every card says
// "Coming soon", and Credits read 0 until runs pay them (earn-only, HANDOFF
// "the troll coin economy"). The Rookie kit is the one you already have.
//
// Opened from modes/zombies/hub.js (hold X at a kiosk); like DJ Lulz's panel
// it frees the mouse while open and takes it back on close, and
// menu/buttons.js doesn't open the pause menu for it.

import { game } from "../core/state.js?v=st1";
import { releaseHeldInputs } from "../menu/pause.js?v=pa1-mb1-if1-fu1b7b7dec1c2-wb1m1c4-tc3-cup1-nc1-cid1-cid2-th2-ar2-ce5-cd1-sh1-cl1-bp1-sg1-bw1-gt1-gt2-cw1-fj1-zr9-zr10-zh1";

const TIERS = [
  { id: 1, label: "Tier 1", cards: ["Sidearm", "Sidearm", "Sidearm"] },
  { id: 2, label: "Tier 2", cards: ["Shotgun", "Shotgun", "SMG"] },
  { id: 3, label: "Tier 3", cards: ["Rifle", "Rifle", "LMG"] },
  { id: 4, label: "Tier 4", cards: ["Heavy", "Heavy", "Wonder weapon"] },
];
const KITS = [
  { name: "Rookie", note: "A turret, a spike barricade and a barrel.", owned: true },
  // the kits modes/zombies/kits.js has room for
  ...["Medic", "Recon", "Trapper", "Pyro", "Demolitionist"].map((name) => ({ name, note: "Coming soon." })),
];

let ui = null;
let open = null;     // "weapons" | "classes" | null
let tier = 1;
let wasLocked = false;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function build() {
  if (ui) return;
  const root = document.createElement("div");
  root.className = "zk";
  root.hidden = true;
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.innerHTML = `
    <div class="zk-panel">
      <div class="zk-head">
        <h2 class="zk-title"></h2>
        <div class="zk-credits" aria-label="Credits"><span class="zk-coin" aria-hidden="true"></span><b class="zk-credits-n">0</b>&nbsp;Credits</div>
        <button type="button" class="zk-close" aria-label="Close">✕</button>
      </div>
      <div class="zk-tabs" role="tablist"></div>
      <div class="zk-cards"></div>
      <p class="zk-foot"></p>
    </div>`;
  (game.els.hud?.parentElement || document.body).appendChild(root);
  ui = {
    root,
    title: root.querySelector(".zk-title"),
    tabs: root.querySelector(".zk-tabs"),
    cards: root.querySelector(".zk-cards"),
    foot: root.querySelector(".zk-foot"),
    close: root.querySelector(".zk-close"),
  };
  ui.close.addEventListener("click", () => closeKiosk());
  root.addEventListener("click", (e) => { if (e.target === root) closeKiosk(); });
  ui.tabs.addEventListener("click", (e) => {
    const b = e.target.closest("[data-tier]");
    if (!b) return;
    tier = +b.dataset.tier;
    render();
  });
  window.addEventListener("keydown", (e) => {
    if (!open) return;
    if (e.code === "Escape" || e.code === "KeyX") { e.preventDefault(); e.stopPropagation(); closeKiosk(); }
  }, true);
}

function render() {
  if (!ui || !open) return;
  ui.root.dataset.kiosk = open;
  if (open === "weapons") {
    ui.title.textContent = "Weapons";
    ui.tabs.hidden = false;
    ui.tabs.innerHTML = TIERS.map((t) => `<button type="button" role="tab" class="zk-tab${t.id === tier ? " is-on" : ""}" aria-selected="${t.id === tier}" data-tier="${t.id}">${t.label}</button>`).join("");
    const t = TIERS.find((x) => x.id === tier) || TIERS[0];
    ui.cards.innerHTML = t.cards.map((kind) => `
      <div class="zk-card is-soon">
        <div class="zk-card-art" aria-hidden="true"></div>
        <div class="zk-card-name">${esc(kind)}</div>
        <div class="zk-card-price">??? Credits</div>
        <div class="zk-ribbon">Coming soon</div>
      </div>`).join("");
    ui.foot.textContent = "Guns you buy here start every run with you. Runs will pay Credits soon.";
  } else {
    ui.title.textContent = "Classes";
    ui.tabs.hidden = true;
    ui.tabs.innerHTML = "";
    ui.cards.innerHTML = KITS.map((k) => `
      <div class="zk-card${k.owned ? " is-owned" : " is-soon"}">
        <div class="zk-card-art is-kit" aria-hidden="true"></div>
        <div class="zk-card-name">${esc(k.name)}</div>
        <div class="zk-card-price">${k.owned ? "Equipped" : "??? Credits"}</div>
        <div class="zk-card-note">${esc(k.note)}</div>
        ${k.owned ? "" : `<div class="zk-ribbon">Coming soon</div>`}
      </div>`).join("");
    ui.foot.textContent = "A class is your kit for every run. More are on the way.";
  }
}

export function kioskOpen() { return !!open; }

export function openKiosk(id) {
  build();
  if (open) return;
  open = id === "classes" ? "classes" : "weapons";
  tier = 1;
  releaseHeldInputs();
  wasLocked = !game.isTouch && !!game.controls?.isLocked;
  ui.root.hidden = false;
  render();
  if (wasLocked) game.controls.unlock();
  ui.close.focus({ preventScroll: true });
}

export function closeKiosk() {
  if (!open) return;
  open = null;
  ui.root.hidden = true;
  releaseHeldInputs();
  if (wasLocked) { try { game.controls.lock(); } catch { /* the pause screen catches it */ } }
}
