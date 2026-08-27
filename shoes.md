# Troll Runner 1s — shoe design

## Background

UMadBro (umadbro.shop) added a community IP-royalty feature: any member can
design a product, and if the community votes it in as an official product,
the designer earns an ongoing royalty per sale — the same royalty mechanic
Carlos Ramirez collects on the Trollface license as a whole, now extended
down to individual community-made SKUs. Logged in trollrunner-terminal's
lore as **§45** (`docs/TROLL-LORE.md`).

First product being designed against this system: a running shoe, since
running is core to the Troll Runner identity.

## The shoe

- **Name:** Troll Runner 1s
- **Pitch:** "Whether it's running troll to billions, or running away from
  trolling someone, running is essential in your daily life. What better
  way to live is there than to start the day by slapping these running
  shoes on?"
- **Price:** $69
- **Category:** max-cushion daily trainer — Mizuno Neo Zen 2 / Brooks Ghost
  Max 4 / Asics Superblast 3 territory. High stack, soft rounded midsole.
  Explicitly **not** a race-day shoe: no carbon plate, no trampoline-bounce
  foam.
- **Submission constraint:** the umadbro.shop design studio caps uploads at
  **3 image files** — compose multiple angles/details into fewer composite
  images rather than one shot per file. No character limit on the listing
  description field.

## Design evolution

1. **v1 — color-blocked panels.** Tan/sage/sky-blue/peach/off-white palette
   pulled from the Asics Superblast 3's blend (flagged by the user as the
   best-looking reference: "tan green blue peach white color blend looks
   good... good grip for speed workouts as well"). Clean panel-based upper,
   embroidered trollface on heel/tongue, flat-lay insole + palette board,
   sunrise action shot. First generated result was strong on color/shape but
   had illegible AI-garbled text on the shoe and inconsistent panel details
   across angles.

2. **v2 — route collage upper.** Pivoted after the user shared the ASICS x
   LA Marathon 2025 finisher shoe as direct inspiration: an all-over
   collage print rather than color-blocked panels, referencing the actual
   race route (neighborhood names, sponsor logos, hand-drawn linework).
   Adapted concept: scatter the Troll Runner's own sticker-drop cities
   (Fontana, Riverside, Rancho Cucamonga, Rialto, Chino Hills — the real
   `DATA` cities from the main site) plus "$TROLL," "UMADBRO," a Solana
   glyph, and a lore stat ("5:20 AM" / "10 miles anyway," from terminal
   lore §33) across the upper instead of generic LA street names.

3. **v3 — insole as a finisher stamp.** The LA Marathon shoe's insole
   photo showed a clean circular stamp badge on the heel (arched
   "LOS ANGELES MARATHON" / "ASICS" text, finisher checkmark, date) rather
   than a busy graphic — quiet contrast to the loud upper. Adapted: arched
   "TROLL RUNNER 1s" / "UMADBRO.SHOP" text around a small trollface grin
   icon standing in for the checkmark, with "5:20 AM" below it.

4. **v4 — jacquard weave, not printed collage.** A close-up of the LA
   Marathon shoe's tongue/vamp revealed the city-name graphics are actually
   **woven into the mesh as a tone-on-tone jacquard texture** (darker
   red/blue on a pink base), not bold printed text sitting on top — reads
   as texture from a distance, resolves into legible words up close. Also
   picked up two more construction details worth carrying over: a small
   contrast-color fabric pull tab at the tongue with a logo, and tiny woven
   lace-loop keepers with their own miniature repeating pattern. Revised
   the upper concept to weave the city names / "$TROLL" / "UMADBRO" into
   the fabric itself in this tonal style, added a trollface-grin pull tab
   and mini-grin-motif lace keepers.

5. **v5 — palette swap.** User requested a new colorway: **black, white,
   semi-dark green, and purple**, replacing the pastel tan/sage/blue/peach
   set from v1–v4. Current palette:
   - **Off-white** — mesh base
   - **Black** — jacquard text weave, outsole, ink accents
   - **Deep forest green** (semi-dark, not neon) — midsole gradient, pull tab
   - **Deep plum purple** (semi-dark) — laces, trim, secondary accent

6. **v6 — text dropped from the upper.** First v5 render came back: palette,
   pull tab, and insole stamp all landed well, but the jacquard city-name
   weave rendered as garbled nonsense ("RAVERSIDO CUCAMONGA," "UMACHO,"
   "RIVECHO CUCAMONGA") — same AI-text failure mode as v1, just moved from
   the midsole to the whole upper. User confirmed: drop the city
   names/route-collage concept entirely, no need for it, and also drop the
   "5:20 AM" line from the insole stamp. Keep the trollface + "UMADBRO.SHOP"
   emblem (that rendered clean) and the color scheme (confirmed working).
   Upper reverts to a clean heathered mesh with no text/graphics at all —
   branding carried entirely by the pull tab and the insole stamp instead of
   an all-over print.

## Current prompt set (v6 — palette + emblem, no text on upper/insole beyond wordmark)

**File 1 — Hero grid (2x2 composite: lateral, medial, 3/4 front, 3/4 rear):**
```
Studio product photography of a running shoe called "Troll Runner 1s," max-cushion daily trainer (Mizuno Neo Zen 2 / Brooks Ghost Max 4 / Asics Superblast 3 proportions — high stack, soft rounded midsole, no visible carbon plate). Upper is an off-white heathered engineered mesh with a subtle fine knit texture, no text or graphics printed or woven into it. A small deep forest-green fabric pull tab at the tongue with a tiny embroidered trollface grin logo. Deep plum-purple laces threaded through small woven fabric lace-loop keepers with a miniature repeating grin-motif pattern. Midsole is a smooth off-white-to-deep-forest-green gradient foam, thick and pillowy, with a thin plum-purple pinstripe along the rim. Outsole is black rubber with small traction pods. Composite four studio shots into one clean 2x2 grid on a seamless light gray background, soft shadows, no props: (1) lateral side view, (2) medial side view, (3) 3/4 front/toe view, (4) 3/4 rear/heel view. Consistent color placement across all four panels.
```

**File 2 — Insole finisher stamp (time removed):**
```
Close-up macro photograph of a running shoe sockliner/insole, shot from directly above, in the style of a marathon finisher shoe stamp. Insole is off-white knit fabric. Centered on the heel area is a circular stamped badge graphic printed directly onto the fabric in black ink, passport-stamp style: arched text along the top reading "TROLL RUNNER 1s," a small hand-drawn trollface grin icon centered in the middle, and arched text along the bottom reading "UMADBRO.SHOP." The rest of the insole is clean, no other graphics. Deep forest-green midsole foam visible around the edges of the frame, deep plum-purple lace visible at the edge. Slightly moody, close, directional lighting like a macro product detail shot, matching a real sneaker unboxing photo rather than a flat studio render.
```

**File 3 — In action:**
```
Low-angle action photograph of a runner's feet mid-stride at sunrise on a paved trail in the Inland Empire (Southern California, dry hills in the background), wearing "Troll Runner 1s" — off-white heathered mesh upper, deep forest-green midsole gradient, deep plum-purple laces, small embroidered trollface grin on the heel tab. Warm golden-hour light, slight motion blur on the trailing foot, sharp focus on the shoe, editorial running-brand photography style.
```

## Reference inspirations

- Mizuno Neo Zen 2
- Brooks Ghost Max 4
- Asics Superblast 3 (tan/green/blue/peach/white blend was the original
  color-palette source; good grip for speed workouts too)
- ASICS x LA Marathon 2025 finisher shoe (source of the collage-upper /
  jacquard-weave / stamp-insole concept — see `lamarathon` Instagram post,
  photos supplied directly by the user)

## Open items

- Regenerate v6 renders (text-free upper) and critique — confirm
  panel-to-panel consistency across the 2x2 grid holds up without the
  jacquard text to distract from it.
- Decide whether $69 pricing holds — the render quality reads closer to a
  $150+ shoe, may be worth revisiting once final art is locked.
- Listing description copy for the (uncapped) description field.
- Possible dedicated lore sub-entry once the shoe actually ships / gets
  voted in, covering the design process itself as its own thread.

## Note to self

Keep this file updated after every shoe-design exchange in conversation —
new ideas, palette/concept changes, critiques of renders — not just when
explicitly asked to write it up.
