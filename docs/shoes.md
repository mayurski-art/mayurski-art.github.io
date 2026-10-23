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

## Design philosophy — creative technique reference (applies to ALL lines)

Standing note, not tied to one shoe: user flagged the **Vans Old Skool 36
Pearlized "Red"** ([House of Heat](https://houseofheat.co/vans/vans-old-skool-36-pearlized-red-vn000e8vizq-release-details),
style `VN000E8VIZQ`, $130, Holiday 2026) as an example of the level of
creativity/craft to study and hold Troll Runner shoe concepts to, going
forward, across every line (Troll Runner 1s, Troll Heelies, Trollface
Crocs, and anything future). Its design: red canvas upper with darker red
suede at the toe/eyestays/heel, **pearls and crystals of mixed sizes worked
directly into the white Jazz Stripe and scattered across toe/tongue/heel**,
mixed with silver eyelets and small metal studs, plus an aged/distressed
midsole treatment (darkened spots, edge scuffing) rather than a clean new-
shoe finish.

Paired with the Yu-Gi-Oh! x Crocs collection (see below, molded dragon
wings / staff attachment built into the shoe itself), the pattern across
both references is: **the interesting part is never just a flat colorway
or a printed graphic — it's a physical/material technique that changes how
the shoe is actually made.** Techniques worth keeping in the toolbox when
concepting any future colorway or line, beyond "pick a palette":

- **Embedded embellishment** — pearls, crystals, studs, or beads worked
  directly into stitching/stripes/panels (Vans Pearlized), not glued-on
  decoration.
- **Molded/sculptural geometry** — a signature shape built into the
  upper, sole, or a physical attachment rather than printed on top (Yu-Gi-Oh
  dragon wings, magician's staff clip).
- **Aged/distressed finishing** — deliberately worn-in midsole, scuffing,
  tonal fading, rather than a pristine studio-clean render, when it suits
  the shoe's story.
- **Material contrast within one upper** — canvas vs. suede panel-swaps in
  the same colorway (Vans toe/eyestay/heel suede), not one uniform fabric.
- **Embroidery** as its own distinct technique from printing — raised
  thread texture and visible stitch density, called out explicitly rather
  than assumed, since it renders and reads differently from a flat graphic
  (relevant to the existing embroidered-vs-PVC patch question above).

When drafting future render prompts for any Troll shoe, actively consider
whether one of these techniques (not just a color/graphic swap) is what
would make that specific design feel "sick and unique" instead of generic.

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

## Spinoff concept — Troll Runner Walkers (velcro patch system)

Separate shoe idea, not a v7 of the Troll Runner 1s: a plain **walking shoe**
(not a performance trainer) whose whole gimmick is a swappable velcro patch
panel, same idea as the customizable patch sneaker at herefreevs.click and
morale-patch tactical boots. One clean base shoe, sold with (or alongside)
a pack of interchangeable trollface-branded patches so the wearer builds
their own identity on the front of the shoe.

**Twist floated by the user: make it Heelys-style** — a single retractable
wheel recessed in the heel, walk normally or shift weight back onto the heel
to roll. Turns the "goofy novelty shoe" energy of a patch-collector sneaker
into an actual gimmick instead of just a cosmetic one — very on-brand for a
meme-mascot shoe that isn't trying to be taken seriously (unlike the Troll
Runner 1s, which is a straight-faced performance trainer). Open questions to
work out before locking this in:
- Single-wheel (classic Heelys) vs. a low-profile dual-wheel setup — single
  wheel is more iconic/recognizable, dual is more stable for an adult-sized
  shoe.
- Wheel is fully **attachable/detachable** (user's call), not just a
  plug-capped well like classic Heelys — the wheel module itself clicks in
  and out of the heel well, so the shoe is either a normal walking shoe with
  an empty/flush heel or a Heely with the module snapped in, wearer's choice.
- Whether the velcro patch panel and the heel wheel compete for attention,
  or whether the patch panel moves to the tongue/vamp specifically so the
  heel stays clear for the wheel mechanism.

- **Base shoe:** simple, low-key walking silhouette — think Skechers/New
  Balance comfort-walker territory, not a trainer. Off-white or black upper,
  minimal branding on the shoe itself.
- **Patch panel:** a rectangular loop (soft-side velcro) field on the lateral
  vamp/tongue, roughly 2.5" x 2", sized to match standard morale-patch
  dimensions so patches are swappable and (eventually) sellable as their own
  add-on SKU line, separate from the shoe purchase.
- **Patches:** embroidered or PVC, hook-backed, sold in a starter pack or
  individually. Seven initial designs:

  1. **Classic trollface** — the original grin: bold black outline, tan/
     yellow face, wide gap-tooth smirk, "u mad?" energy. The default/no-frills
     option, safest pick for anyone who just wants the mascot.
  2. **Eclipse trollface** — tonal blackout variant, inspired by umadbro's
     "Model Eclipse" mousepad: the grin rendered in matte-black-on-gloss-black
     (subtle sheen difference does the linework instead of contrast color),
     with a thin dark ring/halo behind the head standing in for the eclipse.
     Reads as a stealth/all-black patch until light hits it.
  3. **Waifu trollface** — softer anime-inflected variant, inspired by
     umadbro's "Model Waifu" mousepad: same grin shape but with lash-lined
     eyes, a blush mark on each cheek, and a pastel-pink/white palette
     instead of the classic tan. "For the ladies" pick per the user's brief.
  4. **Solana glyph** — the actual Solana cryptocurrency logo: three
     parallel slanted bars/parallelograms staggered into an "S" shape, each
     bar filled with Solana's signature purple-to-teal-green gradient, on a
     rounded-square patch. Ties to the site's existing $TROLL-on-Solana
     branding (same mint used elsewhere on the site).
  5. **"MAD?" wordmark** — bold condensed all-caps "MAD?" text patch (short
     for "u mad?"), stacked or single-line, in the same black/white as the
     classic trollface patch so it reads as a set with #1.
  6. **Gold coin medallion** — round patch styled like a minted coin/token:
     a thick gold ring border (double-lined, like an embossed coin edge),
     dark navy/almost-black starry-space interior, with a plain white
     line-art trollface (outline only, no tan fill, no color) centered
     inside. Reference image supplied directly by the user. Reads as a
     "collector coin" patch rather than a cartoon sticker — pairs naturally
     with the Solana glyph patch (#4) for a crypto-coin shelf-set feel.
  7. **Holographic trollface** — the classic grin die-cut/embroidered onto a
     holographic/iridescent rainbow-foil patch base (same shifting-color
     effect as holographic trading-card foil or iridescent skateboard grip
     tape), so the face itself reads as plain black linework floating on a
     color-shifting rainbow background instead of a flat color fill. Same
     shape as the classic patch (#1), just the foil-vs-flat material swap —
     the "shiny chase variant" of the set.

- **Open question:** whether patches are embroidered (durable, higher cost,
  cleaner edges) or printed PVC/rubber (cheaper, glossier, easier to iterate
  designs on) — matters most for #2 and #3 since the tonal/gradient edges
  render very differently between the two methods.

### Base shoe colorways

Two ASICS GT-2000 15 retail colorways picked as direct base-shoe references
(same idea as pulling the Superblast 3 palette for the Troll Runner 1s):

- **Women's — Hazy Lilac / Taro Purple** ([ANA_1012B998-701](https://www.asics.com/us/en-us/gt-2000-15/p/ANA_1012B998-701.html)):
  soft dusty-lilac upper with a deeper muted taro-purple overlay/heel
  accent. Pairs cleanly with the waifu patch's pastel-pink palette.
- **Men's — Grand Shark / Cantaloupe** ([ANA_1012B998-400](https://www.asics.com/us/en-us/gt-2000-15/p/ANA_1012B998-400.html)):
  dark steel-blue-gray upper with an orange ("cantaloupe") pop on the
  midsole/overlay accents. Pairs with the classic or eclipse trollface
  patch for a bolder look.
  - Note: ASICS' own product grid lists this specific SKU (`1012B998-400`)
    under the women's GT-2000 15 line despite the "for the guys" ask — the
    men's GT-2000 15 uses a different base style code (`1011C235`). Same
    Grand Shark/Cantaloupe tones may just need pulling from a `1011C235`
    men's SKU instead if a true men's-line source shoe matters here.

### v1 result — wheel placement wrong

First render (ChatGPT/DALL-E) nailed both colorways and the patch flat-lay,
but the wheel module came out as a furniture/skateboard-caster bracket
bolted onto the *back* of the heel, sticking out behind the shoe. Real
Heelys build the wheel into the bottom of the outsole itself — recessed
into the tread so it sits flush with the ground plane under the heel, shoe
looks completely normal from the side, and you only see the wheel if you
look at the sole from underneath. User supplied a real Heelys product photo
(sole-up shot) as the correction reference: black low-top skate-shoe
silhouette, wheel housed in a molded socket in the heel of the outsole,
tread pattern wrapping around it.

### Current prompt (v4 — wheel corrected to outsole-recessed, sole-up shot + gold coin + holographic patches added)

```
Studio product photography of a simple comfort walking shoe called "Troll Runner Walkers" (Skechers/New Balance comfort-walker silhouette, NOT a performance running trainer — low-key, rounded, minimal branding). Composite into a single clean image with four sections on a seamless light gray background, soft studio shadows, no visible logos or text on the shoe body itself:

(1) TOP-LEFT: 3/4 side view of the shoe in a "Grand Shark/Cantaloupe" colorway — dark steel-blue-gray upper with a warm orange accent on the midsole and overlay stitching. A rectangular fabric loop-side velcro patch panel (about 2.5 x 2 inches) sits on the lateral vamp/tongue with a bold black-and-tan cartoon troll face grin patch (wide gap-tooth smirk, thick black outline) attached to it. From this side angle the shoe looks completely normal — no wheel, no bracket, no hardware visible anywhere on the upper or the visible side of the sole.

(2) TOP-RIGHT: 3/4 side view of the same shoe shape in a "Hazy Lilac/Taro Purple" colorway — soft dusty lilac upper with a deeper muted purple heel overlay. Same velcro patch panel location, this time with a softer pastel-pink cartoon troll face patch (same grin shape, but with thin eyelash lines and a small blush mark on each cheek). Same normal-looking sole, no visible hardware.

(3) BOTTOM-LEFT: a sole-up product shot (shoe flipped over, looking straight down at the bottom of the outsole, matching a real Heelys sole-view photo) of the Grand Shark/Cantaloupe shoe, showing a single round skate wheel recessed flush into a molded circular socket built into the tread pattern under the heel — the wheel sits flat within the outsole rubber, same way real Heelys wheels are built into the sole, NOT hanging off the back of the heel on a bracket or caster arm. Next to it, a small separate inset shows the round wheel module by itself, popped just slightly out of its socket, to show that it is a separate removable puck-shaped piece that clicks in and out of that same molded socket.

(4) BOTTOM-RIGHT: flat-lay of seven separate velcro patches arranged in two neat rows on a neutral fabric background: (a) classic black-outline tan troll face grin patch, (b) an all-black tonal troll face patch that only reads as a grin from a slight angle due to a subtle glossy-vs-matte black sheen difference, (c) a soft pastel-pink troll face patch with lash-lined eyes and blush marks, (d) a rounded-square patch with the Solana cryptocurrency logo (three staggered slanted parallelogram bars forming an S-shape, gradient-filled from purple to teal-green), (e) a bold condensed all-caps black-and-white "MAD?" wordmark patch, (f) a round gold-coin medallion patch with a thick embossed gold ring border, dark navy starry-space interior, and a plain white line-art trollface (outline only, no color fill) centered inside, like a minted collector coin, (g) the same classic grin patch shape but made of holographic rainbow-foil material, shifting iridescent colors across its surface like holographic trading-card foil, with the grin rendered as plain black linework floating on top of the foil rather than any flat color fill.

Clean commercial product photography lighting throughout, consistent proportions and camera angle within each panel, no other props or backgrounds.
```

### Edit prompt (targeted changes to the existing v1 image, not a regenerate)

For use with an image-edit tool against the actual v1 render above, instead
of generating from scratch again:

```
Edit this exact image, keeping the top-left panel (navy/orange shoe with tan trollface patch) and top-right panel (lilac shoe with pink trollface patch) completely unchanged.

In the bottom-left panel: remove the caster-wheel-on-a-bracket that's currently hanging off the back of the heel. Replace it with a sole-up product shot — the shoe flipped over so we're looking straight down at the bottom of the outsole, matching a real Heelys sole-view photo. Show a single round skate wheel recessed flush into a molded circular socket built directly into the tread pattern under the heel, sitting flat within the outsole rubber rather than mounted on any external bracket or arm. Add a small separate inset next to it showing that same round wheel module by itself, popped just slightly out of its socket, to show it's a separate removable puck-shaped piece that clicks in and out.

In the bottom-right panel: keep the five existing patches exactly as shown (tan classic trollface, all-black tonal trollface, pink trollface, Solana glyph, "MAD?" wordmark), but add two more patches to the row so there are seven total, arranged in two neat rows instead of one: a round gold-coin medallion patch with a thick embossed gold ring border, dark navy starry-space interior, and a plain white line-art trollface (outline only, no color fill) centered inside, like a minted collector coin; and a patch shaped like the classic trollface grin but made of holographic rainbow-foil material, shifting iridescent colors across its surface like holographic trading-card foil, with the grin rendered as plain black linework floating on top of the foil rather than any flat color fill.

Keep the same overall four-panel grid layout, background, and lighting style as the original image.
```

### v2 result — patches fixed, wheel shot still wrong

The edit above worked perfectly for the two shoe panels and the patch
flat-lay (all seven patches rendered correctly, including the gold coin and
holographic ones, in two clean rows). The wheel panel is still broken,
though — a different failure this time: instead of a full recognizable shoe
sole (the whole elongated foot-shaped outsole from toe to heel), it rendered
just an abstract rounded heel-shaped rubber chunk with the wheel socket in
it, disconnected from any obvious "this is the bottom of a shoe" read. Not a
bracket/caster mistake anymore, but still doesn't read as a shoe sole.

Next attempt needs to be far more explicit that the shot must show the
**entire shoe, flipped completely upside down**, full continuous outsole
from toe box to heel, camera directly overhead — not a cropped/isolated
heel piece. User is also planning to run the next image gen on **Grok**
instead of ChatGPT for this round, since most of the product design is
already locked from prior renders.

### Prompt for next attempt (v5 — full sole-view spelled out explicitly)

```
Generate a single product photo: one running/walking shoe (Skechers/New Balance comfort-walker silhouette, dark steel-blue-gray "Grand Shark/Cantaloupe" colorway with orange accents) flipped completely upside down and photographed from directly overhead, so the camera is looking straight down at the full bottom of the shoe.

Show the ENTIRE outsole as one continuous, unmistakably shoe-shaped piece of rubber — the full elongated foot silhouette, wide rounded toe box at one end tapering to a narrower heel at the other end, with a normal running-shoe tread pattern (grooves, traction pods) covering the whole surface. Do not crop, isolate, or show only a fragment of the sole — the whole shoe's outline, from toe to heel, must be visible in one shot, exactly like looking at the bottom of a shoe sitting on a table.

Near the heel end of that same continuous sole (not detached from it, not a separate floating chunk), show a single round skate wheel recessed flush into a molded circular socket built directly into the tread pattern, sitting flat within the rubber, matching how real Heelys shoes build a wheel into the heel of the outsole.

In a small separate inset box next to the main photo, show that same round wheel as an individual removable puck-shaped module, popped just slightly out of its socket, to indicate it clicks in and out.

Plain seamless light gray studio background, soft even shadows, clean commercial product photography lighting.
```

### Upper design — Electric $TROLL lightning theme

User flagged that the shoe upper itself needed some kind of graphic design
treatment beyond just the velcro patches (referencing a Heelys flame-print
colorway as an example of "loud novelty-shoe graphics," not literally
asking for flames). Rather than inventing a new motif from scratch, the
answer was already sitting in the site's own asset library:
`assets/images/banners/banner-07.jpg` — an existing hero banner of the
chrome/electric $TROLL sprinter figure (trollface-headed runner, chrome-white
skin, "$TROLL" text tattooed down the body, mid-stride) set against a deep
blue-to-navy gradient background crossed with bold jagged white lightning
bolts streaking horizontally behind him.

Adapted as a shoe upper print: an **"Electric $TROLL" colorway** — deep
blue-to-navy gradient base fabric with bold jagged white lightning-bolt
graphics streaking from heel to toe (same energy/linework as banner-07's
lightning, not literal flames), chrome/silver metallic eyelets and pull
tab accents, black outsole. Treated as a third signature colorway option
alongside the Grand Shark/Cantaloupe and Hazy Lilac/Taro Purple ASICS-based
colorways, rather than replacing them.

### Upper design — Jungle Ambush camo theme

Second signature colorway, pulled the same way — from an existing site
banner rather than an invented motif: `assets/images/banners/banner-11.jpg`,
a moody hero shot of the trollface figure crouched/lurking in dense dark
green foliage, tactical/olive-drab sleeve visible on one arm, low-key
chiaroscuro lighting with the grin lit up bright white against near-black
shadow and leaves.

Adapted as a shoe upper print: a **"Jungle Ambush" colorway** — dark
leaf-camo pattern (layered dark green/near-black leaf shapes) covering the
upper, olive-drab overlay panels and laces, matte black (not chrome/shiny)
hardware and eyelets, black outsole. The trollface grin motif can either
sit on the velcro patch as usual, or — as a bolder option — be worked
directly into the camo print itself so it only resolves into a visible
face from certain angles/lighting, echoing how the grin in banner-11 is
the one bright shape breaking out of an otherwise near-black leaf pattern.

### Wheel-shot correction — wheel is visible from the side on real Heelys

A real Heelys flame-print shoe photo (two shoes shown side by side, one
upright showing the profile) revealed the wheel is **not** fully hidden and
flush the way earlier prompts assumed — it visibly protrudes slightly from
the side/back of the heel, a small round black wheel poking out past the
outsole silhouette when viewed from the side, not just visible from
directly underneath. Next wheel-shot prompt should show it that way: a
side/3-quarter-rear profile with the wheel peeking out from the heel,
rather than insisting on a fully-flush disappearing wheel.

### Prompt for next attempt (v6 — Electric $TROLL lightning upper + corrected wheel visibility)

```
Studio product photography of a simple comfort walking shoe called "Troll Runner Walkers" (Skechers/New Balance comfort-walker silhouette, low-key rounded shape, not a performance trainer), in an "Electric $TROLL" colorway: deep blue-to-navy gradient upper fabric with bold jagged white lightning-bolt graphics streaking across it from heel to toe, chrome/silver metallic eyelets and a chrome pull tab at the tongue, black outsole. A rectangular fabric loop-side velcro patch panel (about 2.5 x 2 inches) on the lateral vamp/tongue holds a bold black-and-tan classic troll face grin patch.

Show two views composited side by side:

(1) LEFT: a 3/4 side profile view of the shoe on a seamless dark gradient background (matching the lightning-bolt art style), showing a small round black skate wheel visibly protruding slightly from the back/bottom of the heel, past the edge of the outsole — same way real Heelys show their wheel poking out in side profile, not hidden or flush.

(2) RIGHT: a close-up detail shot of that same heel wheel from a slight rear-3/4 angle, showing it as a separate removable puck-shaped module that clicks into a socket built into the heel of the outsole, with a small inset showing the module popped just slightly out.

Clean commercial product photography lighting, consistent shoe proportions and camera height across both panels, no other props.
```

### Prompt for next attempt (v7 — Jungle Ambush camo upper)

```
Studio product photography of a simple comfort walking shoe called "Troll Runner Walkers" (Skechers/New Balance comfort-walker silhouette, low-key rounded shape, not a performance trainer), in a "Jungle Ambush" colorway: dark layered leaf-camo pattern (dark green and near-black leaf shapes) covering the upper, olive-drab overlay panels and laces, matte black hardware and eyelets (no shine/chrome), black outsole. A rectangular fabric loop-side velcro patch panel (about 2.5 x 2 inches) on the lateral vamp/tongue holds a bold black-and-tan classic troll face grin patch.

Show two views composited side by side:

(1) LEFT: a 3/4 side profile view of the shoe on a seamless dark mossy-green gradient background (moody, low-key lighting like something lit from one side in dense foliage), showing a small round black skate wheel visibly protruding slightly from the back/bottom of the heel, past the edge of the outsole.

(2) RIGHT: a close-up detail shot of that same heel wheel from a slight rear-3/4 angle, showing it as a separate removable puck-shaped module that clicks into a socket built into the heel of the outsole, with a small inset showing the module popped just slightly out.

Clean but moody commercial product photography lighting (bright key light on the shoe, near-black shadow falloff, matching a stealth/camo aesthetic), consistent shoe proportions and camera height across both panels, no other props.
```

### Rebrand + base-shoe swap — "Troll Heelies," AF1 LV8 silhouette

User renamed the spinoff from "Troll Runner Walkers" to **Troll Heelies** and
pivoted the base-shoe reference off the ASICS GT-2000 15 comfort-walker
shape entirely. New silhouette source: the Nike Air Force 1 LV8 (Grade
School), style code `FN6980-657`, in University Red/White/Deep Royal Blue —
[shiekh.com listing](https://www.shiekh.com/nike-grade-school-air-force-1-lv8-university-red-white-deep-royal-blue-fn6980-657.html).
Reference construction details pulled from that listing:

- **Silhouette:** classic AF1 shape — leather upper, cupsole construction,
  low-cut padded collar, chunky rounded toe box. Reads as a lifestyle
  sneaker, not a runner or a comfort-walker — matches the "goofy novelty
  shoe" energy better than the Skechers-style base did.
- **Sole:** rubber outsole with heritage hoops pivot circle on the
  forefoot — a natural landmark to build the heel wheel housing against on
  the opposite end of the sole.
- **Air unit:** visible Nike Air cushioning in the heel is a real detail
  worth either working around or leaning into (a wheel module recessed
  where an Air bubble would normally sit is a fun visual pun, open idea).

**Explicitly NOT copying the AF1 LV8's own colorway or branding** (that's
Nike's specific SKU) — silhouette/construction reference only. User wants:

- **New color pattern** — palette still open, needs its own pass rather
  than reusing the red/white/blue from the reference listing or either
  ASICS-based colorway from the Walkers version. Candidates to consider
  next: reuse the Electric $TROLL (navy/lightning/chrome) or Jungle Ambush
  (leaf-camo/olive) treatments already designed above, since both were
  built to be silhouette-agnostic.
- **Material changes** — leather AF1 upper needs at least one panel swapped
  to loop-side velcro-compatible material (or a stitched-on velcro field
  the way earlier prompts specified) to carry the patch system; open
  whether that's the toe-box overlay, the eyestay, or a dedicated panel on
  the lateral vamp like the original Walkers patch placement.
- Heel wheel mechanic (single, detachable, clicks in/out of a molded
  socket) carries over unchanged from the Walkers concept — same open
  questions about single vs. dual wheel and patch-panel vs. wheel-well
  turf war on the heel.
- Seven-patch starter set (classic, eclipse, waifu, Solana glyph, "MAD?"
  wordmark, gold coin, holographic) carries over unchanged.

**Locked for the next render:**
- **Colorway:** reusing **Electric $TROLL** (deep navy/blue gradient,
  jagged white lightning bolts, chrome hardware) rather than inventing a
  new palette — same source art as `assets/images/banners/banner-07.jpg`.
- **Velcro patch placement:** the **lateral quarter panel** — the flat
  overlay area on an AF1 where the Swoosh normally sits — since it's the
  single most visible flat panel on this silhouette and mirrors how morale
  patches sit on tactical boots. Heel stays clear for the wheel mechanic;
  no competition between the two features.

### Final prompt (v8 — AF1 LV8 silhouette + Electric $TROLL lightning + patch)

```
Studio product photography of a lifestyle sneaker called "Troll Heelies," built on a classic Nike Air Force 1-style silhouette (leather-look cupsole construction, low-cut padded collar, chunky rounded toe box, visible heel Air cushioning unit) in an "Electric $TROLL" colorway: deep blue-to-navy gradient upper material with bold jagged white lightning-bolt graphics streaking across it from heel to toe, chrome/silver metallic eyelets and a chrome lace-lock tab at the tongue, black rubber outsole with a hoops-style pivot circle tread pattern on the forefoot. In place of any brand Swoosh, the lateral quarter panel (the flat overlay area on the side of the shoe, above the toe box) is a rectangular loop-side velcro field, about 2.5 x 2 inches, with a bold black-and-tan classic troll face grin patch (wide gap-tooth smirk, thick black outline) attached to it.

Composite three views into one clean image on a seamless dark gradient background (matching the lightning-bolt art style), soft studio shadows, consistent shoe proportions and camera height across all panels:

(1) LEFT: full lateral side profile view of the shoe, showing the lightning-bolt upper graphic, chrome hardware, and velcro patch panel clearly, with a small round black skate wheel visibly protruding slightly from the back/bottom of the heel, past the edge of the outsole — same way real Heelys show their wheel poking out in side profile, not hidden or flush.

(2) TOP-RIGHT: 3/4 front/toe view of the same shoe, showing the rounded toe box, lightning graphic wrap, and patch panel from an angled front perspective.

(3) BOTTOM-RIGHT: close-up detail shot of the heel wheel from a slight rear-3/4 angle, showing it as a separate removable puck-shaped module that clicks into a molded socket built into the heel of the outsole, with a small inset showing the module popped just slightly out of its socket to indicate it's detachable.

Clean commercial product photography lighting throughout, no other props or text overlays.
```

## New line — Trollface Crocs (concept only, revisit later)

Third shoe line, separate from the Troll Runner 1s (performance trainer)
and Troll Heelies (velcro-patch novelty walker): a **Crocs-style clog**,
inspired directly by the upcoming
[Cars x Crocs Classic Clog "Lightning McQueen Dinoco"](https://x.com/JustFreshKicks/status/2092662105422135467?s=20)
release.

**Reference product details** (Crocs Classic Clog "Lightning McQueen
Dinoco," style `213582-90H`, releasing **September 16, 2026** via Crocs.com
and select retailers, price TBD — second Cars x Crocs collab after a Mater
clog in May 2025, tied to the film's 20th anniversary):
- Light-blue "Dinoco" livery referencing the Cars movie's Dinoco-daydream
  scene, with "95" racing number and Lightyear tire graphics on the side.
- Toe-cap Jibbitz styled as cartoon eyes + the Dinoco dinosaur logo with a
  grinning mouth; Dinoco wordmark on the heel strap.
- New construction detail for this release: the **heel strap itself is
  molded into a spoiler shape**, not just a flat strap.
- Note: the user described this as "light-up Crocs," but none of the
  coverage found (JustFreshKicks, WWD, Men's Journal, SneakerNews) mentions
  any LED/light-up feature on this specific release — worth double-checking
  with the user before assuming Trollface Crocs need working lights, since
  that'd be a real hardware feature, not just a graphic treatment.

**Adaptation direction (not yet designed):**
- Base shape: standard Crocs clog silhouette (perforated upper, molded
  footbed, heel strap).
- Trollface angle: same toe-cap-as-face trick as the Dinoco reference —
  the two forefoot vent holes or a toe-cap Jibbitz pair standing in for
  eyes, classic grin worked into the front vamp shape or as a large
  toe-cap patch.
- Heel strap as a design surface, same as the reference's spoiler idea —
  open to reworking into something on-brand (a small trollface flag/tab,
  a "$TROLL" wordmark strap, etc.) rather than a literal spoiler.
- Charms/Jibbitz: natural fit for the same patch-style variety the Troll
  Heelies use (classic/eclipse/waifu/Solana/MAD?/gold-coin/holographic
  grins) — Crocs' Jibbitz slot system may actually be an easier hardware
  fit for swappable trollface charms than the velcro patch panel is.
- Whether to actually pursue the light-up feature (would need real
  hardware, LED + battery + on/off mechanism) or keep it a graphic-only
  clog like the Dinoco reference actually is.

No prompt drafted yet — parking this here per the user's request to come
back to it later.

### More inspiration — Yu-Gi-Oh! x Crocs collection

User flagged this collab as a reference for "how sick and unique the
designs are" — worth studying the *approach*, not just copying a
colorway: [House of Heat post](https://x.com/houseofheat/status/2092755649130107216?s=20),
full writeup at [houseofheat.co](https://houseofheat.co/crocs/yu-gi-oh-crocs-collection-2026-release-details).

**Yu-Gi-Oh! x Crocs Collection** — releases September 1, 2026 via Crocs.com
and select retailers (Foot Locker, etc.), four pairs across two clog
models:

- **Classic Clog — Yugi Mutou** ($70): purple/black/gold/red, card-inspired
  graphic details, chain elements and accents referencing his signature
  look (millennium puzzle chain, etc).
- **Classic Clog — Seto Kaiba** ($70): grey/white/burgundy/blue, details
  pulled from his outfit and his Duel Disk.
- **Echo Clog — Blue-Eyes White Dragon** ($90): almost entirely icy blue,
  **wing-like molded elements extending off the upper itself** (not just a
  printed graphic — actual 3D sculpted geometry), themed graphics
  throughout, matching strap.
  - *(This is the specific pair the user's Sept. 1 / $90 note referred
    to.)*
- **Echo Clog — Dark Magician** ($90): purple with green accents, a
  **staff-inspired physical attachment** clipped onto the shoe, plus more
  molded character-specific details.

**Why this is the reference worth studying:** all four pairs go past
"character-colored clog + a couple of Jibbitz" — they build the character's
signature silhouette directly into the shoe's molded geometry (dragon
wings growing out of the upper, a wand-shaped physical attachment) rather
than relying only on flat graphics and charms. That's the bar to hit if
Trollface Crocs wants to feel "sick and unique" rather than generic:
consider where a trollface-specific molded element (grin shape worked into
the strap or heel, ear/horn nubs, etc.) could do the same job the dragon
wings or magician's staff do here, instead of leaning entirely on
toe-cap-eyes + Jibbitz.

## Note to self

Keep this file updated after every shoe-design exchange in conversation —
new ideas, palette/concept changes, critiques of renders — not just when
explicitly asked to write it up.
