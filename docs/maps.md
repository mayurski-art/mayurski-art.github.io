# Maps — working notes

`trollrunner.net/maps` — the 3D globe where every logged-in troll drops a
pin for the city they're from. Lives as `maps.html` + `assets/js/troll-map.js`
in this repo (ported 1:1 from the standalone `trollrunner-maps` Next.js app —
see that repo for the original source if you need to cross-reference).

Desktop opens it inside an iframe window (`index.html`'s `TD_WINDOWS.maps`);
mobile does a full top-level navigation from `world.html`. Any edit to
`assets/js/troll-map.js` needs its `?v=` cache-bust bumped on the `<script>`
tag in `maps.html` (line ~246) or desktop iframes can keep serving a stale
cached copy indefinitely — this already bit us once (2026-08-24: the
real-color repaint/density choropleth shipped but desktop kept showing the
old flat colors until the version bump landed).

## Current state (2026-08-24)
- Real-color repaint + country density choropleth: done, live.
- "Trolls on the map" stat pill (bottom-left HUD): now has a rotating
  background-image + info carousel instead of one static image/count.
  - Markup: `.stats` pill in `maps.html` has two stacked `.stats-bg` layers
    (`--a`/`--b`) that crossfade via opacity, plus a `.stats-content` layer
    on top for the count/label text.
  - Logic: `STATS_SLIDES` array in `troll-map.js` (near `renderStats`) —
    each entry is `{ bg, render() }` where `render()` returns `{count, label}`.
    A `setInterval` rotation (`STATS_SLIDE_MS`, currently 6s) advances
    through the array and crossfades backgrounds; `renderStats()` (called
    whenever pins refresh) just re-renders the *current* slide's numbers
    without touching the background.
  - Only one slide is wired up right now: pin count, background
    `assets/images/world/troll-world 2.png`. Source images available at
    `assets/images/world/troll-world 1.png` through `4.png` (troll-world 4
    is the trollface-holding-earth one, already considered as a candidate).
  - **Still open**: what the second (and later) slide(s) say. Candidates
    discussed — countries repping (`new Set(pins.map(p => p.country))`),
    top city leader (from `listTopLocations`). User said they'll specify
    exact copy later — pick up from `STATS_SLIDES` in `troll-map.js` when
    that's decided, it's built to extend by just adding array entries.

## Design language
Same dark glass-panel HUD look as the rest of the site (`--void`/`--surface`
tokens in `maps.html`'s `<style>`), DM Sans/DM Mono, rounded panels with
backdrop blur. Background images behind text always get dimmed via the
`.stats-bg::after` rgba overlay for legibility — keep that pattern for any
new slide art.

## Open ideas / not yet built
- More `STATS_SLIDES` entries (content TBD, see above).
- Anything else that comes up — add it here as it's decided so a fresh
  session (or a collaborator) has the context without re-deriving it.
