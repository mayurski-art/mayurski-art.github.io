/* The whole class at a glance, BO2 style, in the detail pane (menu-bo2.js):
   primary + its attachments, secondary, melee, throwable, the three perks
   and the three scorestreaks. The user, 2026-10-17: "I should also be able
   to see a preview of the entire stuff in the class itself like weapons
   scorestreaks perks etc", on every device. Create a Class shows the class
   you're on; a class's own screen shows that class. Read-only: it never
   changes the loadout. */
import { WEAPON_DEFS } from "../weapons/weapons.js?v=p5bm-wst-hf1-fu1-wb1-ar1-ar2-cl1-fj1-zc1-zc2-or1";
import { ATTACHMENTS, SLOTS, SLOT_LABELS } from "../weapons/attachments.js?v=cg1-wst-sb2-fu1-wb1-ar1-ar2-cl1-fj1-zc1-zc2-or1";
import { MELEE_DEFS, THROWABLE_DEFS } from "../weapons/gear.js?v=to-hb1kb3-bk1-wst-ig1-th2-zr5-zr9-zr10-zp1-or1-rb4-hp1-bx1-mg1-sp1";
import { SKIN_BY_ID, skinsFor } from "../characters/skins.js?v=p5-wb1-or1";
import { PERK_DEFS, PERK_TIER_NAMES, PERK_TIER_COLORS, perkIconSvg } from "../progression/perks.js?v=pk1-cl1-bp1-fj1-zc1-zc2-nf1-or1";
import { STREAK_DEFS, streakBadgeSvg } from "../streaks/scorestreaks.js?v=umb1-wst-sb2-fu1-wb1-ar1-ar2-cl1-bp1-fj1-zc1-zc2-nf1-or1";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* What class i carries, as plain data. Stock parts (iron sights, Standard
   barrel, no underbarrel) stay out, like the old summary card's chips. */
export function classPreviewData(L, i) {
  const c = L.classes[i];
  if (!c) return null;
  const atts = L.attachmentsFor(c.weaponId);
  const parts = [];
  for (const slot of SLOTS) {
    const key = atts[slot];
    const att = ATTACHMENTS[slot]?.[key];
    if (!att || key === "none" || key === "standard" || key === "iron") continue;
    parts.push({ slot: SLOT_LABELS[slot], name: att.name });
  }
  if (skinsFor(c.weaponId).length && atts.skin && SKIN_BY_ID[atts.skin]) parts.push({ slot: "Skin", name: `${SKIN_BY_ID[atts.skin].name} skin` });
  const t = THROWABLE_DEFS[c.throwKind === "tactical" ? c.tacticalId : c.lethalId];
  return {
    name: c.name,
    primary: WEAPON_DEFS[c.weaponId]?.name || "None",
    parts,
    secondary: WEAPON_DEFS[c.secondaryId]?.name || "None",
    melee: MELEE_DEFS[c.meleeId]?.name || "None",
    throwable: t ? `${t.name} ×${t.carried}` : "None",
    throwKind: c.throwKind === "tactical" ? "Tactical" : "Lethal",
    perks: [0, 1, 2].map((tier) => ({ tier, id: c.perks?.[tier] || null, def: PERK_DEFS[c.perks?.[tier]] || null })),
    streaks: (c.streaks || []).filter((id) => STREAK_DEFS[id]).map((id) => STREAK_DEFS[id])
      .sort((a, b) => a.cost - b.cost),
  };
}

export function renderClassPreview(host, L, i) {
  const d = classPreviewData(L, i);
  if (!d) { host.innerHTML = ""; return; }
  const perk = (p) => `<li class="to-cp-perk" style="--perk:${PERK_TIER_COLORS[p.tier]}">`
    + `<span class="to-cp-perk-icon${p.def ? "" : " is-empty"}">${p.def ? perkIconSvg(p.id) : ""}</span>`
    + `<span class="to-cp-txt"><small>${PERK_TIER_NAMES[p.tier]}</small><b>${esc(p.def ? (p.def.short || p.def.name) : "None")}</b></span></li>`;
  const streak = (s) => `<li class="to-cp-streak"><span class="to-cp-badge">${streakBadgeSvg(s.id)}</span>`
    + `<span class="to-cp-txt"><b>${esc(s.short || s.name)}</b><small>${s.cost}</small></span></li>`;
  const empties = Math.max(0, 3 - d.streaks.length);
  host.innerHTML = `
    <header class="to-cp-head"><small>Class preview</small><b>${esc(d.name)}</b></header>
    <section class="to-cp-row to-cp-weapons">
      <div class="to-cp-cell to-cp-primary"><small>Primary</small><b>${esc(d.primary)}</b>
        <ul class="to-cp-chips">${d.parts.map((p) => `<li title="${esc(p.slot)}">${esc(p.name)}</li>`).join("") || "<li class=\"is-none\">No attachments</li>"}</ul></div>
      <div class="to-cp-cell"><small>Secondary</small><b>${esc(d.secondary)}</b></div>
    </section>
    <section class="to-cp-row to-cp-gear">
      <div class="to-cp-cell"><small>Melee</small><b>${esc(d.melee)}</b></div>
      <div class="to-cp-cell"><small>${d.throwKind}</small><b>${esc(d.throwable)}</b></div>
    </section>
    <section class="to-cp-group"><h3>Perks</h3><ul class="to-cp-perks">${d.perks.map(perk).join("")}</ul></section>
    <section class="to-cp-group"><h3>Scorestreaks</h3><ul class="to-cp-streaks">${d.streaks.map(streak).join("")}`
    + `${"<li class=\"to-cp-streak is-empty\"><span class=\"to-cp-badge\"></span><span class=\"to-cp-txt\"><b>Empty</b><small>pick one</small></span></li>".repeat(empties)}</ul></section>`;
  host.setAttribute("aria-label", `${d.name}: ${d.primary}, ${d.secondary}, ${d.melee}, ${d.throwable}. Perks ${d.perks.map((p) => p.def?.name || "none").join(", ")}. Scorestreaks ${d.streaks.map((s) => s.name).join(", ") || "none"}.`);
}
