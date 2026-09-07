// Troll Ops — loadout screen: class → weapon → attachments.

import { WEAPON_DEFS, CLASS_ORDER, CLASS_LABELS, weaponsInClass } from "./weapons.js";
import { ATTACHMENTS, SLOTS, SLOT_LABELS, resolveWeapon, defaultLoadoutFor, statBars } from "./attachments.js";
import { getRank, isUnlocked, rankProgress, MAX_RANK } from "./progression.js";

const STORE = "trollops:loadout";

function load() {
  try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; }
}
function save(state) {
  try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* private mode */ }
}

export class Loadout {
  constructor(els, onChange) {
    this.els = els;
    this.onChange = onChange || (() => {});

    const saved = load();
    this.attachmentsByWeapon = saved.attachments || {};
    this.weaponId = saved.weaponId && WEAPON_DEFS[saved.weaponId] ? saved.weaponId : "problem416";
    if (!isUnlocked(this.weaponId)) this.weaponId = "problem416";
    this.cls = WEAPON_DEFS[this.weaponId].cls;

    this.buildClasses();
    this.buildSlots();
    this.render();
  }

  get attachments() {
    if (!this.attachmentsByWeapon[this.weaponId]) {
      this.attachmentsByWeapon[this.weaponId] = defaultLoadoutFor(this.weaponId);
    }
    return this.attachmentsByWeapon[this.weaponId];
  }

  get resolved() { return resolveWeapon(this.weaponId, this.attachments); }

  persist() {
    save({ weaponId: this.weaponId, attachments: this.attachmentsByWeapon });
    this.onChange(this.resolved);
  }

  buildClasses() {
    const wrap = this.els.classes;
    wrap.innerHTML = "";
    for (const cls of CLASS_ORDER) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "to-lo-class";
      b.textContent = CLASS_LABELS[cls];
      b.dataset.cls = cls;
      b.addEventListener("click", () => {
        this.cls = cls;
        const first = weaponsInClass(cls).find((id) => isUnlocked(id)) || weaponsInClass(cls)[0];
        if (first) this.weaponId = first;
        this.persist();
        this.render();
      });
      wrap.appendChild(b);
    }
  }

  buildSlots() {
    const wrap = this.els.atts;
    wrap.innerHTML = "";
    this.slotButtons = {};
    for (const slot of SLOTS) {
      const row = document.createElement("div");
      row.className = "to-lo-slot";
      const label = document.createElement("span");
      label.className = "to-lo-slot-label";
      label.textContent = SLOT_LABELS[slot];
      row.appendChild(label);

      const opts = document.createElement("div");
      opts.className = "to-lo-slot-opts";
      this.slotButtons[slot] = {};
      for (const [key, att] of Object.entries(ATTACHMENTS[slot])) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "to-lo-att";
        b.textContent = att.name;
        b.title = att.desc;
        b.setAttribute("aria-label", `${SLOT_LABELS[slot]}: ${att.name} — ${att.desc}`);
        b.addEventListener("click", () => {
          this.attachments[slot] = key;
          this.persist();
          this.render();
        });
        opts.appendChild(b);
        this.slotButtons[slot][key] = b;
      }
      row.appendChild(opts);
      wrap.appendChild(row);
    }
  }

  render() {
    const rank = getRank();
    const def = this.resolved;

    for (const b of this.els.classes.children) {
      b.classList.toggle("is-active", b.dataset.cls === this.cls);
      b.setAttribute("aria-pressed", String(b.dataset.cls === this.cls));
    }

    // --- weapon list for the active class
    const list = this.els.list;
    list.innerHTML = "";
    for (const id of weaponsInClass(this.cls)) {
      const w = WEAPON_DEFS[id];
      const unlocked = isUnlocked(id);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "to-lo-weapon";
      b.classList.toggle("is-active", id === this.weaponId);
      b.classList.toggle("is-locked", !unlocked);
      b.disabled = !unlocked;
      b.setAttribute("aria-pressed", String(id === this.weaponId));
      b.innerHTML = `<strong>${w.name}</strong><span>${unlocked ? `${w.damage} dmg · ${w.rpm} rpm` : `Unlocks at rank ${w.rank}`}</span>`;
      if (!unlocked) b.setAttribute("aria-label", `${w.name}, locked, unlocks at rank ${w.rank}`);
      b.addEventListener("click", () => {
        this.weaponId = id;
        this.persist();
        this.render();
      });
      list.appendChild(b);
    }

    // --- detail panel
    this.els.name.textContent = def.name;
    this.els.blurb.textContent = def.blurb || "";

    const bars = statBars(def);
    this.els.stats.innerHTML = "";
    for (const [label, value] of Object.entries(bars)) {
      if (label.startsWith("_")) continue;
      const row = document.createElement("div");
      row.className = "to-lo-stat";
      row.innerHTML = `<span>${label}</span><i><b style="width:${Math.round(value * 100)}%"></b></i>`;
      this.els.stats.appendChild(row);
    }

    for (const slot of SLOTS) {
      for (const [key, b] of Object.entries(this.slotButtons[slot])) {
        const on = this.attachments[slot] === key;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", String(on));
      }
    }

    // --- rank strip
    if (this.els.rank) {
      this.els.rank.textContent = rank >= MAX_RANK ? `Rank ${MAX_RANK} · maxed` : `Rank ${rank}`;
      this.els.rankFill.style.width = `${Math.round(rankProgress() * 100)}%`;
    }
  }
}
