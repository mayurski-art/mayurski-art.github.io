// Troll Ops — loadout screen: class → weapon → attachments.

import { WEAPON_DEFS, CLASS_ORDER, CLASS_LABELS, weaponsInClass } from "./weapons.js";
import { ATTACHMENTS, SLOTS, SLOT_LABELS, resolveWeapon, defaultLoadoutFor, statBars } from "./attachments.js";
import { getRank, getXp, isUnlocked, rankProgress, MAX_RANK, XP_PER_RANK } from "./progression.js";
import { MAPS, MAP_IDS, mapSchematic } from "./maps.js";

const STORE = "trollops:loadout";

function load() {
  try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; }
}
function save(state) {
  try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* private mode */ }
}

/* Draws a map's collider footprints top-down into a card thumbnail. The
   canvas is sized from its laid-out box, so this has to run while the card is
   actually visible — hence the redraw when the Match Setup panel opens. */
function drawMapThumb(canvas, id) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!w || !h) return false;

  const { rects, bounds } = mapSchematic(id);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);

  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.fillStyle = "#0d1116";
  ctx.fillRect(0, 0, w, h);

  const mw = bounds.maxX - bounds.minX;
  const md = bounds.maxZ - bounds.minZ;
  if (!(mw > 0 && md > 0)) return true;

  const pad = 5;
  const scale = Math.min((w - pad * 2) / mw, (h - pad * 2) / md);
  const ox = (w - mw * scale) / 2;
  const oy = (h - md * scale) / 2;

  ctx.fillStyle = "rgba(24,32,26,.9)";
  ctx.fillRect(ox, oy, mw * scale, md * scale);

  ctx.fillStyle = "rgba(150,175,145,.3)";
  ctx.strokeStyle = "rgba(190,215,180,.34)";
  ctx.lineWidth = 0.6;
  for (const r of rects) {
    const x = ox + (r.x0 - bounds.minX) * scale;
    const y = oy + (r.z0 - bounds.minZ) * scale;
    ctx.fillRect(x, y, Math.max(1, (r.x1 - r.x0) * scale), Math.max(1, (r.z1 - r.z0) * scale));
    ctx.strokeRect(x, y, Math.max(1, (r.x1 - r.x0) * scale), Math.max(1, (r.z1 - r.z0) * scale));
  }

  ctx.strokeStyle = "rgba(127,224,102,.3)";
  ctx.lineWidth = 1;
  ctx.strokeRect(ox + 0.5, oy + 0.5, mw * scale - 1, md * scale - 1);
  return true;
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
    this.mapId = MAPS[saved.mapId] ? saved.mapId : MAP_IDS[0];

    this.buildMaps();
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
    save({ weaponId: this.weaponId, mapId: this.mapId, attachments: this.attachmentsByWeapon });
    this.onChange(this.resolved);
  }

  buildMaps() {
    const wrap = this.els.maps;
    if (!wrap) return;
    wrap.innerHTML = "";
    for (const id of MAP_IDS) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "to-lo-map";
      b.dataset.map = id;
      b.title = MAPS[id].blurb;
      const thumb = document.createElement("canvas");
      thumb.className = "to-map-thumb";
      thumb.setAttribute("aria-hidden", "true");
      b.appendChild(thumb);
      const name = document.createElement("span");
      name.className = "to-map-name";
      name.textContent = MAPS[id].name;
      b.appendChild(name);
      const tag = document.createElement("span");
      tag.className = "to-map-tag";
      b.appendChild(tag);
      b.setAttribute("aria-label", `Map: ${MAPS[id].name} — ${MAPS[id].blurb}`);
      b.addEventListener("click", () => {
        this.mapId = id;
        this.persist();
        this.render();
      });
      wrap.appendChild(b);
    }
    this.mapBlurb = document.createElement("span");
    this.mapBlurb.className = "to-lo-map-blurb";
    wrap.appendChild(this.mapBlurb);
    this.thumbsDrawn = false;
    requestAnimationFrame(() => this.drawMapThumbs());
  }

  /* Schematics are built lazily, one card per frame, so opening the lobby
     doesn't stall while five arenas are constructed and thrown away. */
  drawMapThumbs() {
    if (this.thumbsDrawn || !this.els.maps) return;
    const cards = [...this.els.maps.querySelectorAll(".to-lo-map")];
    let i = 0;
    const step = () => {
      const card = cards[i];
      if (!card) { this.thumbsDrawn = true; return; }
      const ok = drawMapThumb(card.querySelector(".to-map-thumb"), card.dataset.map);
      if (!ok) return;          // panel isn't visible yet; try again when it is
      i++;
      requestAnimationFrame(step);
    };
    step();
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

    if (this.els.maps) {
      for (const b of this.els.maps.children) {
        if (!b.dataset.map) continue;
        const on = b.dataset.map === this.mapId;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", String(on));
        const tag = b.querySelector(".to-map-tag");
        if (tag) tag.textContent = on ? "Deploying here" : "Select";
      }
      if (this.mapBlurb) this.mapBlurb.textContent = MAPS[this.mapId].blurb;
    }

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

    this.renderSummary(def, bars, rank);
  }

  /* The always-visible readout down the right: what you are dropping in with,
     mirroring the detail panel so the loadout stays legible from any tab. */
  renderSummary(def, bars, rank) {
    const sum = this.els.sum;
    if (!sum) return;

    if (sum.cls) sum.cls.textContent = CLASS_LABELS[this.cls] || "Loadout";
    if (sum.name) sum.name.textContent = def.name;
    if (sum.attWeapon) sum.attWeapon.textContent = ` — ${def.name}`;

    if (sum.atts) {
      sum.atts.innerHTML = "";
      for (const slot of SLOTS) {
        const att = ATTACHMENTS[slot][this.attachments[slot]];
        const row = document.createElement("div");
        row.className = "to-pf-row";
        const label = document.createElement("span");
        label.textContent = SLOT_LABELS[slot];
        const value = document.createElement("b");
        value.textContent = att ? att.name : "—";
        row.append(label, value);
        sum.atts.appendChild(row);
      }
    }

    if (sum.stats) {
      sum.stats.innerHTML = "";
      for (const [label, value] of Object.entries(bars)) {
        if (label.startsWith("_")) continue;
        const row = document.createElement("div");
        row.className = "to-lo-stat";
        row.innerHTML = `<span></span><i><b style="width:${Math.round(value * 100)}%"></b></i>`;
        row.firstChild.textContent = label;
        sum.stats.appendChild(row);
      }
    }

    if (sum.xp) {
      sum.xp.textContent = rank >= MAX_RANK
        ? `${getXp()} XP`
        : `${getXp() % XP_PER_RANK} / ${XP_PER_RANK} XP`;
    }

    if (sum.next) {
      const next = Object.entries(WEAPON_DEFS)
        .filter(([id]) => !isUnlocked(id))
        .sort((a, b) => a[1].rank - b[1].rank)[0];
      sum.next.textContent = next ? `${next[1].name} · rank ${next[1].rank}` : "Everything unlocked";
    }
  }
}
