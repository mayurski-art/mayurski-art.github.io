# Troll Runner — Project Instructions

## What this is
A single-page tracker at mayurski-art.github.io for troll-sticker drops
placed during runs through the Inland Empire (San Bernardino + Riverside
counties, CA). The site is one self-contained index.html with inline CSS
and vanilla JS. No build step, no frameworks, no npm. Hosted on GitHub
Pages via CNAME.

## Design language
- Apple-inspired: DM Sans + DM Mono, dark chrome (#1c1c1e / gradient
  header), light map panels (#f2efe9 / #f5f5f7), rounded corners
  (10–18px), hairline borders (0.5px rgba), subtle shadows.
- Each city has a single accent color used for pin, tab, badge, popup tag.
  Current palette: Fontana #5856d6, Riverside #34c759, Rancho Cucamonga
  #ff9500, Rialto #ff2d55, Chino Hills #007aff.
- Keep copy short, sentence case, slightly cheeky.
- NEVER use the troll Unicode emoji (U+1F9CC) anywhere — not in copy, UI
  labels, pins, headers, avatars, or code comments. The mascot is the real
  trollface ART (assets/animations/troll-grin.gif, assets/images/icons/*,
  assets/pfp/*), never the emoji. Where a mascot mark is needed, use the
  artwork; where it was only decoration, drop it entirely.

## Data model (DATA array)
{city, name, date:"MMM D, YYYY", count, px, py} where px/py are 0–100
coordinates on the stylized canvas map. When adding locations, pick
px/py by eyeballing the current map and matching nearby pins from the
same city.

## Rules when editing
1. Keep it one file. Do not add dependencies, bundlers, or split into
   modules unless I explicitly ask.
2. Stats (total stickers, locations, cities) must be COMPUTED from DATA
   at render time — never hardcoded. "Miles Ran" is a separate manual
   value, keep it as a constant at the top of the script.
3. Preserve the existing color system — new cities need a full entry in
   CITIES {pin, bg, txt}.
4. Maintain mobile responsiveness (stack sidebar above map under 760px).
5. Accessibility: keyboard-focusable pins/cards, aria-labels on icon-
   only controls, don't rely on color alone.
6. No analytics, no trackers, no external scripts beyond Google Fonts.

## Git workflow
- Develop on feature branches, commit with clear messages, push to
  origin. Don't open PRs unless asked.
- Don't touch CNAME.

## Things I may ask for
- Adding a new run: I'll give you city + list of {spot, count}, you
  append to DATA with today's date and reasonable px/py.
- Swapping the fake canvas map for a real Leaflet/OSM map.
- Per-location photos, route traces, run-grouping.
- Shareable deep links (?loc=... to open a specific pin).
- OG tags / favicon / SEO polish.
