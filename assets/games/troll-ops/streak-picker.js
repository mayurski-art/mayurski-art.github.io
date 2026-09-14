// Troll Ops — the lobby's scorestreak picker: choose three.
//
// A sibling to loadout.js's Loadout rather than part of it. This is a flat
// pick-three list with no sub-slots, no attachments and no detail panel, and
// folding it into that class would mean threading unrelated state through a
// constructor already building five regions.

import { STREAK_DEFS, STREAK_IDS, LOADOUT_SIZE, streakUnlocked } from "./scorestreaks.js";

const STORE = "trollops:streaks";

function load() {
  try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; }
}
function save(state) {
  try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* private mode */ }
}

export class StreakPicker {
  constructor(els, onChange) {
    this.els = els;
    this.onChange = onChange || (() => {});

    const saved = load();
    const wanted = Array.isArray(saved.selected) ? saved.selected : [];
    // A saved pick can be locked again — the rank track is local and can be
    // reset — so filter before falling back to the cheapest unlocked ones.
    this.selected = wanted.filter((id) => STREAK_DEFS[id] && streakUnlocked(id)).slice(0, LOADOUT_SIZE);
    if (!this.selected.length) this.selected = this.defaults();

    this.build();
    this.render();
  }

  defaults() {
    return STREAK_IDS.filter((id) => streakUnlocked(id)).slice(0, LOADOUT_SIZE);
  }

  persist() {
    save({ selected: this.selected });
    this.onChange(this.selected);
  }

  /* Picking a fourth evicts the oldest, so the list is never wedged full —
     the alternative is making people deselect before selecting, which reads
     as the UI being broken. */
  toggle(id) {
    const at = this.selected.indexOf(id);
    if (at >= 0) this.selected.splice(at, 1);
    else {
      this.selected.push(id);
      if (this.selected.length > LOADOUT_SIZE) this.selected.shift();
    }
    this.persist();
    this.render();
  }

  build() {
    const wrap = this.els.picker;
    if (!wrap) return;
    wrap.innerHTML = "";
    this.buttons = {};

    for (const id of STREAK_IDS) {
      const def = STREAK_DEFS[id];
      const unlocked = streakUnlocked(id);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "to-ss-card";
      b.disabled = !unlocked;
      b.classList.toggle("is-locked", !unlocked);
      b.innerHTML = "<strong></strong><span></span><em></em>";
      b.querySelector("strong").textContent = def.name;
      b.querySelector("span").textContent = unlocked ? `${def.cost} score` : `Rank ${def.rank}`;
      b.querySelector("em").textContent = def.blurb;
      b.setAttribute("aria-label",
        `${def.name} — ${unlocked ? `${def.cost} score. ${def.blurb}` : `locked until rank ${def.rank}`}`);
      b.addEventListener("click", () => this.toggle(id));
      wrap.appendChild(b);
      this.buttons[id] = b;
    }
  }

  render() {
    if (!this.buttons) return;
    for (const [id, b] of Object.entries(this.buttons)) {
      const on = this.selected.includes(id);
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", String(on));
      const slot = this.selected.indexOf(id);
      b.dataset.slot = slot >= 0 ? String(slot + 1) : "";
    }
    if (this.els.count) {
      this.els.count.textContent = `${this.selected.length} / ${LOADOUT_SIZE} selected`;
    }
  }
}
