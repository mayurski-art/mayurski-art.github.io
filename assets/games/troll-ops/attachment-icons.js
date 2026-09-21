// Troll Ops — Customize card icons.
//
// Small side-on line drawings of each attachment, so a card reads as a part
// before you read its name. Inline SVG rather than image files: they're a few
// hundred bytes each, they inherit `currentColor` so the selected/locked
// states tint for free, and there's no extra request per card.
//
// All of them are drawn in a 40×24 box looking at the part from the left,
// muzzle pointing left — the same three-quarter-ish angle the lobby inspector
// rests at, so the icon and the 3D model agree about which way round it is.

const svg = (body) =>
  `<svg viewBox="0 0 40 24" fill="none" stroke="currentColor" stroke-width="1.4"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ATTACHMENT_ICONS = {
  optic: {
    // Bare rail + front post: no glass at all.
    iron: svg(`<path d="M4 17h32"/><path d="M8 17v-3M12 17v-3M16 17v-3M20 17v-3M24 17v-3"/>
               <path d="M31 17V8"/><path d="M28 9h6"/>`),
    // Open frame, canted lens, dot in the middle.
    reflex: svg(`<path d="M10 18h20"/><path d="M13 18V9M27 18V9"/><path d="M13 9h14"/>
                 <path d="M16 17 24 10"/><circle cx="20" cy="13.5" r="1.4" fill="currentColor" stroke="none"/>`),
    // Closed tube dot with a shade on the objective.
    coyote: svg(`<rect x="9" y="7" width="22" height="10" rx="2.5"/><path d="M6 6.5v11"/>
                 <path d="M6 7h3M6 17h3"/><path d="M15 18v3M25 18v3"/><path d="M12 21h16"/>
                 <circle cx="20" cy="12" r="1.5" fill="currentColor" stroke="none"/>`),
    // Short, fat, tapered body with the fibre-optic pipe on top.
    acog: svg(`<path d="M7 6.5 7 17.5 30 15.5 30 8.5Z"/><path d="M4 5.5v13"/>
               <path d="M32 9.5h3v5h-3"/><path d="M11 5 26 4" stroke-dasharray="2 2"/>
               <path d="M14 18v3M26 16v3"/><path d="M11 21h18"/>`),
    // Long slim tube, objective bell, turret, scope rings.
    scope8: svg(`<path d="M3 5v14"/><path d="M3 6h4v12H3"/><rect x="7" y="8" width="24" height="8" rx="1.5"/>
                 <path d="M31 7.5h5v9h-5"/><path d="M19 8V5h4v3"/>
                 <path d="M12 16v4M27 16v4"/><path d="M9 20h21"/>`),
  },
  barrel: {
    // Plain crowned muzzle.
    none: svg(`<path d="M6 9h26v6H6Z"/><path d="M6 9v6" stroke-width="2"/>`),
    // Long ribbed can.
    suppressor: svg(`<rect x="4" y="7" width="26" height="10" rx="2"/>
                     <path d="M10 7v10M14 7v10M18 7v10M22 7v10M26 7v10"/>
                     <path d="M30 9.5h6v5h-6"/>`),
    // Top-vented device.
    comp: svg(`<rect x="6" y="8" width="18" height="8" rx="1.5"/>
               <path d="M10 8V5M15 8V5M20 8V5"/><path d="M24 10h8v4h-8"/>
               <path d="M6 10v4" stroke-width="2"/>`),
    // Side-ported brake, seen from above-ish.
    brake: svg(`<rect x="6" y="7" width="18" height="10" rx="1.5"/>
                <path d="M10 7v10M15 7v10M20 7v10"/>
                <path d="M6 10.5h18M6 13.5h18"/><path d="M24 10h8v4h-8"/>`),
  },
  underbarrel: {
    // Empty rail.
    none: svg(`<path d="M6 10h28"/><path d="M10 10v3M15 10v3M20 10v3M25 10v3M30 10v3"/>`),
    // Column hanging straight down, finger grooves.
    vert: svg(`<path d="M6 8h28"/><rect x="16" y="8" width="8" height="13" rx="3"/>
               <path d="M16 12h8M16 15h8M16 18h8"/>`),
    // Raked wedge.
    angled: svg(`<path d="M6 8h28"/><path d="M15 8h9l-4 11-6-3Z"/><path d="M16 12l6-2M17 15l6-2"/>`),
    // Boxy unit with a beam coming out of the front.
    laser: svg(`<path d="M6 7h28"/><rect x="14" y="9" width="12" height="7" rx="1.5"/>
                <path d="M14 12.5h-4"/><path d="M9 12.5H3" stroke-dasharray="1 2.5"/>
                <circle cx="12" cy="12.5" r="1.2" fill="currentColor" stroke="none"/>`),
  },
  ammo: {
    // Ball round: plain ogive.
    standard: svg(`<path d="M14 6c5 0 9 3 11 6-2 3-6 6-11 6Z"/><rect x="8" y="6" width="6" height="12" rx="1"/>
                   <path d="M8 9h6M8 15h6"/>`),
    // Hollow point: flat-tipped, hollowed nose.
    hollow: svg(`<path d="M14 6c5 0 8 3 9 6-1 3-4 6-9 6Z"/><path d="M23 10.5h-4v3h4"/>
                 <rect x="8" y="6" width="6" height="12" rx="1"/><path d="M8 9h6M8 15h6"/>`),
    // AP: hardened penetrator core drawn inside the jacket.
    ap: svg(`<path d="M14 6c5 0 9 3 11 6-2 3-6 6-11 6Z"/>
             <path d="M16 9c3 0 5 1.6 6.5 3-1.5 1.4-3.5 3-6.5 3Z" fill="currentColor" stroke="none"/>
             <rect x="8" y="6" width="6" height="12" rx="1"/><path d="M8 9h6M8 15h6"/>`),
  },
};

export function iconFor(slot, key) {
  return ATTACHMENT_ICONS[slot]?.[key] || "";
}
