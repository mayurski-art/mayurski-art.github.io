// Troll Forces — loadout screen: class → weapon → attachments.

import { WEAPON_DEFS, CLASS_ORDER, SECONDARY_CLASSES, CLASS_LABELS, weaponsInClass } from "../weapons/weapons.js?v=p5bm-wst-hf1-fu1-wb1-ar1-ar2-cl1-fj1-zc1-zc2-or1-rfx1-ret1-mrg1-mrc1-tw1-ars1-p416";
import { ATTACHMENTS, SLOTS, SLOT_LABELS, resolveWeapon, defaultLoadoutFor, fits, fitLoadout, statBars, statDelta } from "../weapons/attachments.js?v=cg1-wst-sb2-fu1-wb1-ar1-ar2-cl1-fj1-zc1-zc2-or1-rfx1-ret1-mrg1-mrc1-tw1-ars1-p416";
import { iconFor } from "../weapons/attachment-icons.js?v=or1";
import { SKIN_BY_ID, skinsFor, skinThumbUrl } from "../characters/skins.js?v=p5-wb1-or1-sk1";
import { weaponLevel } from "./weapon-xp.js?v=wx1";
import { getRank, getLevel, getPrestige, PRESTIGE_MASTER, isUnlocked, rankUnlocked, rankProgress, rankXpText, prestigeUnlocked } from "./progression.js?v=p5-wst-sb2-fu1-wb1-ar1-ar2-cl1-fj1-zc1-zc2-nf1-or1-rfx1-ret1-mrg1-mrc1-tw1-ars1-p416";
import { playerIconSvg } from "./rank-icons.js?v=rk1-or1";
import { MAPS, MAP_IDS, REWARD_MAPS, mapSchematic } from "../maps/maps.js?v=p5tc-k9-em1-wst-tl1-bs1-tl2-sb1-rp1-dj1-cr1-db1-sb2-db2a-db2b-db2c-db3-db4-db5-gj1-fu1b7b7dc1c2f1m1u-tc3-nc1-cd1-sh1-sg1-bw1-cw1-zr10-zh1-hr2-zp1-jb1-nh1-pi1-sr1-hl1-pf1-ub1-uw1-ug5-or1-bw2-bt1-wf1-wf2-zf1-bp1-is1-gf1-tg1-tcs1-kb0-kb1-kb2-kb3-cl1-kb4-kb5-kb6-kb7-kb8-kb9-kb10-kb11-ip1-tcs2-mg1-kb12-tm3-tm4-tm6-tm7-tcp1-tx1-trk1-bt2-bt3-ch1-jb3-jb6-sp1-hh1-yb1-kbt1-gb1-gb3-rh1-gb4-tb1-gb5-gb7-gb8-gb9-tb2-bl1-kbb1-kbb2-dj2-kbb3-kbs1-mn1-nd1-dm1-gr1-kbk1-pm1-kbk2-zw1-kco1-tfp1-tfp2-tfp3-tfp4-tfp7-tfb8-tfs1-ss1-ta1-ss2-ss3-ta2-tfm2-rfx1-rm1-kzf1-hgb1-hgb2-hgb3-ugb1-ug1-ug2-ug3-ug4-ugm1-hgb4-hgb5-hgb6-hgb8-hgb9-tw1-op1-hgo1-wb1";
import { MELEE_DEFS, MELEE_IDS, THROWABLE_DEFS, LETHAL_IDS, TACTICAL_IDS } from "../weapons/gear.js?v=to-hb1kb3-bk1-wst-ig1-th2-zr5-zr9-zr10-zp1-or1-rb4-hp1-bx1-mg1-sp1";
import { PERK_DEFS, validPerks } from "./perks.js?v=pk1-cl1-bp1-fj1-zc1-zc2-nf1-or1-rfx1-ret1-mrg1-mrc1-tw1-ars1-p416";

const STORE = "trollops:loadout";
// The scorestreak picker's own key (streak-picker.js). The active class's
// three are mirrored into it, so whatever reads it keeps working.
const STREAK_STORE = "trollops:streaks";

/* Five saved classes, BO2's Create a Class (user, 2026-10-10). Each holds a
   primary, a secondary, a melee, the one throwable, three scorestreaks and a
   perk per tier. Attachments stay per gun, shared by every class that
   carries it (one tuning per gun). */
export const CLASS_COUNT = 5;
const CLASS_FIELDS = ["weaponId", "secondaryId", "meleeId", "lethalId", "tacticalId", "throwKind"];
export function cleanClassName(s) {
  return String(s || "").replace(/[^\w .'!?&-]/g, "").replace(/\s+/g, " ").trim().slice(0, 16);
}
const clampClass = (i) => (Number.isInteger(i) && i >= 0 && i < CLASS_COUNT ? i : 0);

/* The save as v2. A v1 save (one flat loadout, the streaks in their own
   key) becomes Class 1, and Classes 2-5 start as copies of it. */
function migrate(saved) {
  let classes = saved.v === 2 && Array.isArray(saved.classes) ? saved.classes : null;
  if (!classes) {
    let streaks = [];
    try { streaks = JSON.parse(localStorage.getItem(STREAK_STORE))?.selected || []; } catch { /* none */ }
    const base = { streaks, perks: [] };
    for (const k of CLASS_FIELDS) base[k] = saved[k];
    classes = [base];
  }
  const active = clampClass(saved.active);
  const out = [];
  for (let i = 0; i < CLASS_COUNT; i++) {
    let c = classes[i] || classes[0] || {};
    // The flat v1 fields are the active class's (writeSave keeps them in
    // step); if something else changed them, they win for that class.
    if (i === active) {
      c = { ...c };
      for (const k of CLASS_FIELDS) if (saved[k] !== undefined) c[k] = saved[k];
    }
    out.push({
      ...c,
      name: cleanClassName(c.name) || `Class ${i + 1}`,
      streaks: Array.isArray(c.streaks) ? c.streaks.slice(0, 3) : [],
      perks: [0, 1, 2].map((t) => (Array.isArray(c.perks) && c.perks[t]) || null),
    });
  }
  return { ...saved, v: 2, active, classes: out };
}

/* Prestige finishes (skins.js) open at their prestige, camos at the gun's
   own weapon level (weapon-xp.js). A saved pick you can't wear right now
   (signed out, say) is kept, but the gun goes out in factory. */
export function finishUnlocked(skin, weaponId) {
  if (skin?.level && weaponId) return weaponLevel(weaponId) >= skin.level;
  return !skin?.prestige || prestigeUnlocked(skin.prestige);
}
const lockText = (skin) => skin.level ? `Unlocks at weapon level ${skin.level}` : `Unlocks at Prestige ${skin.prestige}`;
function wearable(atts, weaponId) {
  const s = atts?.skin && SKIN_BY_ID[atts.skin];
  return s && !finishUnlocked(s, weaponId) ? { ...atts, skin: null } : atts;
}

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

/* A melee/throwable card's lock state, from the level right now. */
function paintGearLock(b, slot, label, def) {
  const unlocked = rankUnlocked(def.rank);
  b.disabled = !unlocked;
  b.classList.toggle("is-locked", !unlocked);
  b.querySelector("span").textContent = unlocked
    ? (slot === "melee" ? `${def.damage} dmg` : `Carry ${def.carried}`)
    : `LV ${def.rank}`;
  b.setAttribute("aria-label",
    `${label}: ${def.name} — ${unlocked ? def.blurb : `locked until level ${def.rank}`}`);
}

/* How a gun fires, in words (no fireMode: one shot a pull, as
   view/player-update.js fires it). */
export function fireModeLabel(def) {
  switch (def?.fireMode) {
    case "auto": return "Automatic";
    case "burst": return `${def.burst || 3}-round burst`;
    case "bolt": return "Bolt-action";
    case "pump": return "Pump-action";
    case "charge": return "Charge shot";
    default: return "Semi-automatic";
  }
}

export class Loadout {
  constructor(els, onChange) {
    this.els = els;
    this.onChange = onChange || (() => {});
    // the gun the detail panel shows (renderDetail)
    this.detailId = null;
    window.addEventListener("trollforces:preview-end", () => this.endDetailPreview());
    els.list?.addEventListener("mouseleave", () => this.endDetailPreview());
    // Hovering a weapon, melee or throwable in the menu previews it (set by
    // menu/lobby.js); the row's focus event carries it.
    this.onPreview = null;
    this.gearShown = null;

    // Called when the active class changes (menu/lobby.js points the
    // scorestreak picker at the new class's three).
    this.onClassChange = null;

    const saved = migrate(load());
    this.attachmentsByWeapon = saved.attachments || {};
    this.classes = saved.classes.map((c) => this.validClass(c));
    this.active = saved.active;
    this.slot = "primary";   // which slot the class/weapon list below is editing
    this.cls = WEAPON_DEFS[this.weaponId].cls;
    this.mapId = MAPS[saved.mapId] ? saved.mapId : MAP_IDS[0];
    // A mode with its own short list of maps (Zombies) remembers its pick
    // separately, so choosing a zombies map never changes your versus map.
    this.poolMapId = MAPS[saved.poolMapId] ? saved.poolMapId : null;
    this.mapPool = null;
    this.privateRoom = false;   // game.js: a room code is set (prestige maps play only there)

    this.buildMaps();
    this.buildSlotToggle();
    this.buildClasses();
    this.buildSlots();
    this.buildGear();
    this.render();
  }

  /* A saved class with every pick checked against the level right now. The
     account level lands after the page loads, so a pick that fails here is
     only swapped in memory: the save keeps it until the player changes
     something, and restoreSaved() puts it back once the profile is in. */
  validClass(c) {
    let weaponId = WEAPON_DEFS[c.weaponId] ? c.weaponId : "problem416";
    if (!isUnlocked(weaponId)) weaponId = "problem416";
    // Secondary is a sidearm or a launcher - sixtynine (rank 0) is the one
    // every account has unlocked, same reasoning as the problem416 primary
    // fallback.
    let secondaryId = SECONDARY_CLASSES.includes(WEAPON_DEFS[c.secondaryId]?.cls) ? c.secondaryId : "sixtynine";
    if (!isUnlocked(secondaryId)) secondaryId = "sixtynine";
    return {
      name: c.name, weaponId, secondaryId,
      // Gear falls back to the rank-0 option whenever a saved pick is unknown
      // or has been locked again (the rank track is local and can be reset).
      meleeId: this.validGear(c.meleeId, MELEE_DEFS, MELEE_IDS),
      lethalId: this.validGear(c.lethalId, THROWABLE_DEFS, LETHAL_IDS),
      tacticalId: this.validGear(c.tacticalId, THROWABLE_DEFS, TACTICAL_IDS),
      // One throwable slot (user, 2026-09-29): a lethal OR a tactical, never
      // both. Both picks are remembered; `throwKind` says which one you carry.
      throwKind: c.throwKind === "tactical" ? "tactical" : "lethal",
      streaks: [...c.streaks],
      perks: validPerks(c.perks),
    };
  }

  /* The class being edited and carried. Every per-class pick reads and
     writes through it, so the rest of the game never sees the classes. */
  get cur() { return this.classes[this.active]; }
  get weaponId() { return this.cur.weaponId; }
  set weaponId(v) { this.cur.weaponId = v; }
  get secondaryId() { return this.cur.secondaryId; }
  set secondaryId(v) { this.cur.secondaryId = v; }
  get meleeId() { return this.cur.meleeId; }
  set meleeId(v) { this.cur.meleeId = v; }
  get lethalId() { return this.cur.lethalId; }
  set lethalId(v) { this.cur.lethalId = v; }
  get tacticalId() { return this.cur.tacticalId; }
  set tacticalId(v) { this.cur.tacticalId = v; }
  get throwKind() { return this.cur.throwKind; }
  set throwKind(v) { this.cur.throwKind = v; }
  get className() { return this.cur.name; }
  get classStreaks() { return this.cur.streaks; }
  get classPerks() { return this.cur.perks; }

  /* Make class i the one you edit and carry. */
  setActiveClass(i) {
    if (i === this.active || !this.classes[i]) return;
    this.active = i;
    this.slot = "primary";
    this.gearShown = null;
    this.cls = WEAPON_DEFS[this.weaponId].cls;
    this.rebuild();
    this.persist();
    this.onClassChange?.();
  }

  renameClass(i, name) {
    const n = cleanClassName(name);
    if (!n || !this.classes[i]) return false;
    this.classes[i].name = n;
    this.writeSave();
    return true;
  }

  /* The scorestreak picker's three, for the active class (no onChange: the
     preview is showing the streak, not the gun). */
  setClassStreaks(ids) {
    this.cur.streaks = ids.slice(0, 3);
    this.writeSave();
  }

  setClassPerk(tier, id) {
    this.cur.perks[tier] = id || null;
    this.writeSave();
    this.render();
  }

  /* One line for a class row: primary, secondary, melee, throwable. */
  classSummary(i) {
    const c = this.classes[i];
    if (!c) return "";
    const t = THROWABLE_DEFS[c.throwKind === "tactical" ? c.tacticalId : c.lethalId];
    return [WEAPON_DEFS[c.weaponId]?.name, WEAPON_DEFS[c.secondaryId]?.name, MELEE_DEFS[c.meleeId]?.name, t?.name].filter(Boolean).join(" · ");
  }

  rebuild() {
    this.buildClasses();
    this.buildSlots();
    this.buildGear();
    this.render();
  }

  // Which weapon id the class/weapon list panel is currently editing -
  // the primary by default, or the secondary while the slot toggle is set
  // to "Secondary". Attachments, the detail panel and the weapon list all
  // key off this instead of `weaponId` directly, so the same UI serves
  // both slots without duplicating it.
  get activeId() { return this.slot === "secondary" ? this.secondaryId : this.weaponId; }
  set activeId(id) {
    if (this.slot === "secondary") this.secondaryId = id;
    else this.weaponId = id;
  }

  attachmentsFor(id) {
    if (!this.attachmentsByWeapon[id]) {
      this.attachmentsByWeapon[id] = defaultLoadoutFor(id);
    } else {
      // A save from before the class rules (a reflex on a sniper) gets the
      // part swapped for one that fits, in place, so the screen shows it.
      Object.assign(this.attachmentsByWeapon[id], fitLoadout(id, this.attachmentsByWeapon[id]));
    }
    return this.attachmentsByWeapon[id];
  }

  get attachments() { return this.attachmentsFor(this.activeId); }

  get resolved() { return resolveWeapon(this.weaponId, wearable(this.attachmentsFor(this.weaponId), this.weaponId)); }
  get resolvedSecondary() { return resolveWeapon(this.secondaryId, wearable(this.attachmentsFor(this.secondaryId), this.secondaryId)); }
  // Whichever of the two the slot toggle currently has open — for previews
  // (the 3D inspector), never for equipping: equipFromLoadout always wants
  // `resolved`/`resolvedSecondary` specifically, not "whatever's on screen".
  get resolvedActive() { return resolveWeapon(this.activeId, wearable(this.attachments, this.activeId)); }

  get melee() { return MELEE_DEFS[this.meleeId]; }
  /* What the Gear panel's preview shows: the last melee or throwable picked. */
  get gearPreview() { return this.gearShown || this.melee; }
  get lethal() { return THROWABLE_DEFS[this.lethalId]; }
  get tactical() { return THROWABLE_DEFS[this.tacticalId]; }
  /* The one throwable you carry. */
  get throwable() { return this.throwKind === "tactical" ? this.tactical : this.lethal; }
  /* How many of this kind you drop in with: the carried kind's count, 0 for the other. */
  carried(kind) { return kind === this.throwKind ? this[kind].carried : 0; }

  /* Reload the whole save: the classes, which one is active and every
     gun's attachments. Runs when the account level lands after the page
     loads (slowest on phones: until then the level is this device's guest
     total and validClass may have swapped saved picks for rank-0 fallbacks;
     nothing is persisted until the player changes something, so the saved
     picks are still the real ones), and when the cloud copy arrives. It used
     to re-read only the five ids, so the next persist() wrote this device's
     stale attachments back over the cloud's. */
  restoreSaved() {
    const saved = migrate(load());
    const before = JSON.stringify([this.active, this.classes, this.attachmentsByWeapon]);
    this.attachmentsByWeapon = saved.attachments || {};
    this.classes = saved.classes.map((c) => this.validClass(c));
    this.active = saved.active;
    if (JSON.stringify([this.active, this.classes, this.attachmentsByWeapon]) === before) return false;
    this.cls = WEAPON_DEFS[this.activeId].cls;
    this.rebuild();
    this.onChange(this.resolvedActive);
    this.onClassChange?.();
    return true;
  }

  validGear(id, defs, ids) {
    if (id && defs[id] && rankUnlocked(defs[id].rank)) return id;
    return ids.find((k) => rankUnlocked(defs[k].rank)) || ids[0];
  }

  persist() {
    this.writeSave();
    this.onChange(this.resolvedActive);
  }

  /* v2: the five classes. The active class's picks are also written flat at
     the top level, the v1 shape, so a device still on an older build reads
     the class you're carrying. */
  writeSave() {
    const flat = {};
    for (const k of CLASS_FIELDS) flat[k] = this.cur[k];
    save({
      ...flat,
      v: 2, active: this.active, classes: this.classes,
      mapId: this.mapId, poolMapId: this.poolMapId,
      attachments: this.attachmentsByWeapon,
    });
    if (this.cur.streaks.length) {
      try { localStorage.setItem(STREAK_STORE, JSON.stringify({ selected: this.cur.streaks })); } catch { /* private mode */ }
    }
  }

  buildMaps() {
    const wrap = this.els.maps;
    if (!wrap) return;
    wrap.innerHTML = "";
    // The prestige reward maps (The Pentagrin, Trollface Island) sit at the
    // end of the versus list, locked until their prestige and a private room.
    const all = this.mapPool || [...MAP_IDS, ...Object.keys(REWARD_MAPS)];
    for (const id of this.mapAllow ? all.filter((m) => this.mapAllow.includes(m)) : all) {
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
      tag.textContent = MAPS[id].blurb;
      b.appendChild(tag);
      b.setAttribute("aria-label", `Map: ${MAPS[id].name} — ${MAPS[id].blurb}`);
      b.addEventListener("click", () => {
        if (this.mapPool) this.poolMapId = id;
        else this.mapId = id;
        this.persist();
        this.render();
      });
      wrap.appendChild(b);
    }
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

  /* The Play tab's map card: the map you'll deploy into, or the one a mode
     forces (Zombies, the range), which also hides Change. */
  setForcedMap(id) {
    this.forcedMapId = id;
    this.renderMapCard();
  }

  /* A mode that picks from its own list (Zombies): the drawer shows only
     those maps, and the pick is kept apart from the versus map. */
  setMapPool(pool) {
    const same = (pool || null) === this.mapPool
      || (pool && this.mapPool && pool.join() === this.mapPool.join());
    if (same) return;
    this.mapPool = pool ? [...pool] : null;
    this.buildMaps();
    this.render();
  }

  /* A mode open on only some maps (Socialize): the drawer shows just those,
     and a versus pick outside them is kept for the other modes but not
     played here. */
  setMapAllow(list) {
    const same = (list || null) === this.mapAllow
      || (list && this.mapAllow && list.join() === this.mapAllow.join());
    if (same) return;
    this.mapAllow = list ? [...list] : null;
    this.buildMaps();
    this.render();
  }

  /* A prestige reward map: its prestige, in a private room. Others always. */
  mapOpen(id) {
    const p = REWARD_MAPS[id];
    return !p || (this.mapPool ? true : this.privateRoom && prestigeUnlocked(p));
  }

  /* The versus map you'll get: your pick, unless it's a reward map you
     can't play here (a public room, or signed out), then the first map. */
  get versusMapId() {
    if (this.mapAllow && !this.mapAllow.includes(this.mapId)) return this.mapAllow[0];
    return this.mapOpen(this.mapId) ? this.mapId : MAP_IDS[0];
  }

  setPrivateRoom(on) {
    if (this.privateRoom === !!on) return;
    this.privateRoom = !!on;
    this.render();
  }

  /* The map the Play tab will deploy into. */
  get activeMapId() {
    if (this.forcedMapId) return this.forcedMapId;
    if (this.mapPool) return this.mapPool.includes(this.poolMapId) ? this.poolMapId : this.mapPool[0];
    return this.versusMapId;
  }

  renderMapCard() {
    const card = this.els.mapCard;
    if (!card) return;
    const id = this.activeMapId;
    const map = MAPS[id];
    const name = map?.name || (id === "pentagrin" ? "The Pentagrin" : id);
    if (card.name) card.name.textContent = name;
    if (card.blurb) card.blurb.textContent = map?.blurb || "This mode brings its own map.";
    if (card.change) card.change.hidden = !!this.forcedMapId;
    if (card.thumb) card.thumb.setAttribute("aria-label", `${name} layout`);
    this.mapCardDrawn = null;
    this.drawMapCard();
  }

  drawMapCard() {
    const thumb = this.els.mapCard?.thumb;
    const id = this.activeMapId;
    if (!thumb || this.mapCardDrawn === id) return;
    try {
      if (drawMapThumb(thumb, id)) this.mapCardDrawn = id;
    } catch { /* a map without a schematic just keeps the blank tile */ }
  }

  /* Primary/Secondary toggle above the class tabs. Secondary only ever
     picks from the sidearm class - there's nowhere else to put that
     restriction, since buildClasses/the weapon list below are shared by
     both slots verbatim. */
  buildSlotToggle() {
    const wrap = this.els.slotToggle;
    if (!wrap) return;
    wrap.innerHTML = "";
    for (const slot of ["primary", "secondary"]) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "to-lo-class to-lo-slotbtn";
      b.textContent = slot === "primary" ? "Primary" : "Secondary";
      b.dataset.slot = slot;
      b.addEventListener("click", () => {
        this.slot = slot;
        this.cls = WEAPON_DEFS[this.activeId].cls;
        this.buildClasses();
        this.render();
        // Nothing about switching slots touches weaponId/secondaryId, so
        // persist() (the usual onChange trigger) never runs here — without
        // this the 3D preview keeps showing whichever weapon was up before
        // the toggle, i.e. the secondary never actually appears.
        this.onChange(this.resolvedActive);
      });
      wrap.appendChild(b);
    }
  }

  buildClasses() {
    const wrap = this.els.classes;
    wrap.innerHTML = "";
    const classes = this.slot === "secondary" ? SECONDARY_CLASSES : CLASS_ORDER;
    for (const cls of classes) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "to-lo-class";
      b.textContent = CLASS_LABELS[cls];
      b.dataset.cls = cls;
      b.addEventListener("click", () => {
        this.cls = cls;
        const first = weaponsInClass(cls).find((id) => isUnlocked(id)) || weaponsInClass(cls)[0];
        if (first) this.activeId = first;
        this.persist();
        this.render();
      });
      wrap.appendChild(b);
    }
  }

  /* Customize: one row per slot, each a strip of illustrated cards. A card
     carries the part's icon, name and what it does, and — filled in by
     renderAtts once a weapon is known — the stat deltas picking it would
     cause. The old build was a line of bare text pills, which meant the
     screen that exists to compare parts showed nothing to compare. */
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

        const icon = document.createElement("i");
        icon.className = "to-att-icon";
        icon.innerHTML = iconFor(slot, key);
        b.appendChild(icon);

        const text = document.createElement("span");
        text.className = "to-att-text";
        const name = document.createElement("strong");
        name.textContent = att.name;
        const desc = document.createElement("small");
        desc.textContent = att.desc;
        text.append(name, desc);
        b.appendChild(text);

        // Filled per-render: the deltas depend on the weapon it's bolted to.
        const delta = document.createElement("span");
        delta.className = "to-att-delta";
        b.appendChild(delta);

        b.title = att.desc;
        b.addEventListener("click", () => {
          this.attachments[slot] = key;
          this.persist();
          this.render();
        });
        opts.appendChild(b);
        this.slotButtons[slot][key] = { btn: b, delta, att };
      }
      row.appendChild(opts);
      wrap.appendChild(row);
    }
    this.buildSkins(wrap);
  }

  /* Skin row: a card per skin with its baked preview, plus the factory
     finish. Only shown for weapons that can wear skins; the choice is kept
     with that weapon's attachments, so it saves with the loadout. */
  buildSkins(wrap) {
    const row = document.createElement("div");
    row.className = "to-lo-slot to-lo-skinrow";
    const label = document.createElement("span");
    label.className = "to-lo-slot-label";
    label.textContent = "Skin";
    row.appendChild(label);
    const opts = document.createElement("div");
    opts.className = "to-lo-slot-opts to-lo-skins";
    row.appendChild(opts);
    wrap.appendChild(row);
    this.skinRow = row;
    this.skinOpts = opts;
    this.skinButtons = new Map();
    this.skinWeapon = null;
  }

  renderSkins() {
    if (!this.skinRow) return;
    const skins = skinsFor(this.activeId);
    this.skinRow.hidden = skins.length === 0;
    if (!skins.length) return;
    // Cards are built once per weapon, then only their state changes.
    if (this.skinWeapon !== this.activeId) {
      this.skinWeapon = this.activeId;
      this.skinOpts.innerHTML = "";
      this.skinButtons.clear();
      for (const skin of [{ id: null, name: "Factory", blurb: "The finish it left the factory in." }, ...skins]) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "to-lo-skin";
        const img = document.createElement("img");
        img.src = skinThumbUrl(skin.id || "factory");
        img.alt = "";
        img.loading = "lazy";
        img.decoding = "async";
        const name = document.createElement("strong");
        name.textContent = skin.name;
        b.append(img, name);
        if (skin.level) {
          const lv = document.createElement("span");
          lv.className = "to-lo-skin-lv";
          lv.textContent = skin.level === 30 ? "Mastery" : `LV ${skin.level}`;
          b.appendChild(lv);
        }
        b.title = skin.blurb;
        b.addEventListener("click", () => {
          this.attachments.skin = skin.id;
          this.persist();
          this.render();
        });
        this.skinOpts.appendChild(b);
        this.skinButtons.set(skin.id, { b, skin });
      }
    }
    const current = this.attachments.skin || null;
    for (const [id, { b, skin }] of this.skinButtons) {
      const on = id === current;
      const open = finishUnlocked(skin, this.activeId);
      b.classList.toggle("is-active", on);
      b.classList.toggle("is-locked", !open);
      b.disabled = !open;
      b.setAttribute("aria-pressed", String(on));
      b.title = open ? skin.blurb : `${lockText(skin)}.`;
      b.setAttribute("aria-label", `Skin: ${skin.name}. ${open ? skin.blurb : `Locked, ${lockText(skin).toLowerCase()}.`}${on ? " Equipped" : ""}`);
    }
  }

  /* The detail panel: name, blurb, how it fires and the stat bars, for the
     equipped gun or the one being previewed (back to the equipped one when
     the preview ends: off the list, or the menu's trollforces:preview-end). */
  renderDetail(def) {
    if (!def || !this.els.stats) return;
    this.els.name.textContent = def.name;
    this.els.blurb.textContent = def.blurb || "";
    this.els.stats.innerHTML = "";
    const mode = document.createElement("p");
    mode.className = "to-lo-firemode";
    mode.textContent = fireModeLabel(def);
    this.els.stats.appendChild(mode);
    for (const [label, value] of Object.entries(statBars(def))) {
      if (label.startsWith("_")) continue;
      const row = document.createElement("div");
      row.className = "to-lo-stat";
      row.innerHTML = `<span>${label}</span><i><b style="width:${Math.round(value * 100)}%"></b></i>`;
      this.els.stats.appendChild(row);
    }
    this.detailId = def.id;
  }
  endDetailPreview() {
    if (this.detailId !== this.activeId) this.renderDetail(this.resolvedActive);
  }

  /* Selected state plus the per-card stat deltas, recomputed whenever the
     weapon or any other slot changes — a compensator's recoil cut reads
     differently on an LMG than on an SMG, and stacking a grip changes what
     the next part is worth. */
  renderAtts() {
    for (const slot of SLOTS) {
      for (const [key, entry] of Object.entries(this.slotButtons[slot])) {
        const { btn, delta, att } = entry;
        // Only parts that fit this class are offered (attachments.js CLASS_FIT).
        btn.hidden = !fits(this.activeId, slot, key);
        if (btn.hidden) continue;
        const on = this.attachments[slot] === key;
        btn.classList.toggle("is-active", on);
        btn.setAttribute("aria-pressed", String(on));

        delta.innerHTML = "";
        const rows = statDelta(this.activeId, this.attachments, slot, key);
        // Two chips keeps every card one chip-row tall, so a slot's cards
        // stay the same height and the four rows fit without scrolling.
        // They're already ordered by how much players care (damage first,
        // handling last), so the two that survive are the two that matter.
        for (const d of rows.slice(0, 2)) {
          const chip = document.createElement("b");
          if (d.text != null) {
            chip.className = "is-info";
            chip.textContent = `${d.label} ${d.text}`;
          } else {
            chip.className = d.good ? "is-up" : "is-down";
            chip.textContent = `${d.label} ${d.pct > 0 ? "+" : ""}${d.pct}%`;
          }
          delta.appendChild(chip);
        }

        // The screen-reader label has to carry the same comparison the chips
        // show, or the deltas are sighted-only.
        const spoken = rows.length
          ? rows.map((d) => (d.text != null
              ? `${d.spoken} ${d.text}`
              : `${d.spoken} ${d.pct > 0 ? "up" : "down"} ${Math.abs(d.pct)} percent`)).join(", ")
          : "no stat change";
        btn.setAttribute("aria-label",
          `${SLOT_LABELS[slot]}: ${att.name}. ${att.desc}. ${on ? "Equipped" : spoken}`);
      }
    }
  }

  /* Gear panel: one row per slot, each a strip of rank-gated cards. The
     three slots differ only in which table they read, so they share a
     builder rather than three near-identical blocks. */
  buildGear() {
    const wrap = this.els.gear;
    if (!wrap) return;
    wrap.innerHTML = "";
    this.gearButtons = {};

    // Lethals and tacticals share one "Throwable" row: you carry one of them.
    const rows = [
      ["melee", "Melee", MELEE_DEFS, MELEE_IDS, "meleeId"],
      ["throwable", "Throwable", THROWABLE_DEFS, [...LETHAL_IDS, ...TACTICAL_IDS], null],
    ];

    for (const [slot, label, defs, ids, prop] of rows) {
      const row = document.createElement("div");
      row.className = "to-lo-gearrow";
      const head = document.createElement("span");
      head.className = "to-lo-slot-label";
      head.textContent = label;
      row.appendChild(head);

      const opts = document.createElement("div");
      opts.className = "to-lo-gearopts";
      this.gearButtons[slot] = {};
      for (const id of ids) {
        const def = defs[id];
        const b = document.createElement("button");
        b.type = "button";
        b.className = "to-lo-gear";
        b.innerHTML = "<strong></strong><span></span>";
        b.querySelector("strong").textContent = def.name;
        b.title = def.blurb;
        paintGearLock(b, slot, label, def);
        b.addEventListener("focus", () => this.onPreview?.(def));
        b.addEventListener("click", () => {
          this.gearShown = def;
          if (prop) this[prop] = id;
          else {
            this.throwKind = def.kind;
            if (def.kind === "lethal") this.lethalId = id; else this.tacticalId = id;
          }
          this.persist();
          this.render();
        });
        opts.appendChild(b);
        this.gearButtons[slot][id] = b;
      }
      row.appendChild(opts);
      wrap.appendChild(row);
    }
  }

  renderGear() {
    if (!this.gearButtons) return;
    const active = { melee: this.meleeId, throwable: this.throwable.id };
    for (const [slot, buttons] of Object.entries(this.gearButtons)) {
      for (const [id, b] of Object.entries(buttons)) {
        // The cards are built once, usually before the account's level has
        // loaded; re-check the lock every render or they stay locked.
        if (slot === "melee") paintGearLock(b, slot, "Melee", MELEE_DEFS[id]);
        else paintGearLock(b, slot, "Throwable", THROWABLE_DEFS[id]);
        const on = active[slot] === id;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", String(on));
      }
    }
  }

  render() {
    const rank = getRank();
    const def = resolveWeapon(this.activeId, this.attachments);

    if (this.els.slotToggle) {
      for (const b of this.els.slotToggle.children) {
        const on = b.dataset.slot === this.slot;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", String(on));
      }
    }

    if (this.els.maps) {
      for (const b of this.els.maps.children) {
        if (!b.dataset.map) continue;
        const on = b.dataset.map === this.activeMapId;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", String(on));
        const p = !this.mapPool && REWARD_MAPS[b.dataset.map];
        if (p) {
          const open = this.mapOpen(b.dataset.map);
          b.disabled = !open;
          b.classList.toggle("is-locked", !open);
          const tag = b.querySelector(".to-map-tag");
          tag.textContent = !prestigeUnlocked(p) ? `Prestige ${p} reward. Private matches you host.`
            : open ? MAPS[b.dataset.map].blurb : "Your prestige map: set a private room code to play it.";
        }
      }
    }
    this.renderMapCard();

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
      const lockText = w.prestige ? `Unlocks at Prestige ${w.prestige}` : `Unlocks at level ${w.rank}`;
      b.classList.toggle("is-active", id === this.activeId);
      b.classList.toggle("is-locked", !unlocked);
      b.disabled = !unlocked;
      b.setAttribute("aria-pressed", String(id === this.activeId));
      b.innerHTML = `<strong>${w.name}</strong><span>${unlocked ? `${w.damage} dmg · ${w.rpm} rpm` : lockText}</span>`;
      if (!unlocked) b.setAttribute("aria-label", `${w.name}, locked, ${lockText.toLowerCase()}`);
      // The preview and the stats both follow the gun you're on (user,
      // 2026-10-25: "so should the stats of that weapon")
      const preview = () => {
        const d = resolveWeapon(id, wearable(this.attachmentsFor(id), id));
        this.onPreview?.(d);
        this.renderDetail(d);
      };
      b.addEventListener("focus", preview);
      b.addEventListener("mouseenter", preview);
      b.addEventListener("click", () => {
        this.activeId = id;
        this.persist();
        this.render();
      });
      list.appendChild(b);
    }

    // --- detail panel
    this.renderDetail(def);

    this.renderAtts();
    this.renderSkins();

    // --- rank strip
    if (this.els.rank) {
      // The owner has no level, just the badge (style.css .is-owner).
      // Prestige shows ahead of the Troll Forces level ("P3 · Level 12").
      const level = getLevel(), owner = level === null, p = getPrestige();
      const pre = p >= PRESTIGE_MASTER ? "Master · " : p > 0 ? `P${p} · ` : "";
      // The rank or prestige icon leads (rank-icons.js); text read elsewhere
      // (menu-bo2.js) comes from textContent, which the icon adds nothing to.
      if (owner) this.els.rank.textContent = "Owner";
      else this.els.rank.innerHTML = `${playerIconSvg(level, p, 18)}${pre}Level ${level}`;
      this.els.rank.classList.toggle("has-rank-icon", !owner);
      this.els.rank.classList.toggle("is-owner", owner);
      this.els.rankFill.style.width = `${Math.round(rankProgress() * 100)}%`;
    }

    this.renderGear();
    this.renderSummary(def, statBars(def), rank);
  }

  /* The always-visible readout down the right: what you are dropping in with,
     mirroring the detail panel so the loadout stays legible from any tab. */
  renderSummary(def, bars, rank) {
    const sum = this.els.sum;
    if (!sum) return;

    if (sum.cls) sum.cls.textContent = this.className || "Loadout";
    const perks = document.getElementById("to-pf-sum-perks");
    if (perks) perks.textContent = this.classPerks.map((id) => PERK_DEFS[id]?.short || PERK_DEFS[id]?.name).filter(Boolean).join(" · ") || "None";
    if (sum.name) sum.name.textContent = this.resolved.name;
    if (sum.secondary) sum.secondary.textContent = this.resolvedSecondary.name;
    if (sum.attWeapon) sum.attWeapon.textContent = ` — ${def.name}`;
    if (sum.melee) sum.melee.textContent = this.melee.name;
    if (sum.lethal) sum.lethal.textContent = `${this.throwable.name} ×${this.throwable.carried}`;
    if (sum.tactical) sum.tactical.parentElement.hidden = true;   // one throwable slot now

    // The primary's fitted parts as chips; stock parts (iron sights, Standard
    // barrel, no underbarrel...) are left out so the card only shows what you chose.
    if (sum.atts) {
      sum.atts.innerHTML = "";
      const atts = this.attachmentsFor(this.weaponId);
      const chip = (text, title) => {
        const c = document.createElement("span");
        c.className = "to-pf-chip";
        c.textContent = text;
        if (title) c.title = title;
        sum.atts.appendChild(c);
      };
      for (const slot of SLOTS) {
        const key = atts[slot];
        const att = ATTACHMENTS[slot][key];
        if (!att || key === "none" || key === "standard" || key === "iron") continue;
        chip(att.name, SLOT_LABELS[slot]);
      }
      if (skinsFor(this.weaponId).length) {
        chip(`${SKIN_BY_ID[atts.skin]?.name || "Factory"} skin`, "Skin");
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
      sum.xp.textContent = rankXpText();
    }

    if (sum.next) {
      const next = Object.entries(WEAPON_DEFS)
        .filter(([id]) => !isUnlocked(id))
        .sort((a, b) => a[1].rank - b[1].rank)[0];
      // nothing left to unlock: no "Next unlock" line at all (user,
      // 2026-10-15: remove "Everything unlocked")
      sum.next.textContent = next ? `${next[1].name} · LV ${next[1].rank}` : "";
      if (sum.next.parentElement) sum.next.parentElement.hidden = !next;
    }
  }
}
