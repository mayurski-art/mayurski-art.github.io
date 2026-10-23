# Troll Bones — product design

## Background

Same umadbro.shop community IP-royalty system as [shoes.md](shoes.md):
design a product, community votes it in, designer earns an ongoing
royalty per sale (docs/TROLL-LORE.md §45 in trollrunner-terminal).

Second product being designed against this system: pet treats — dog
treats first, cat treats as a follow-up SKU.

## The treats

- **Name: Troll Bones** (locked)
- **Pitch:** TBD — something in the same cheeky, sentence-case, slightly
  unhinged voice as the rest of the brand.
- **Format:** hard-baked crunchy biscuit, bone-shaped territory (like
  Retriever's) rather than a soft jerky stick — small/brown, bulk-bag
  scale.
- **The bit:** classic trollface grin stamped on each biscuit, and the
  bone shape itself is leaned into a phallic silhouette — dogs won't
  care, owners will laugh, it's a novelty gag as much as a treat.
- **Category:** hard-baked bulk biscuit (Retriever Peanut Butter Dog
  Biscuits tier — budget, crunchy, bone-adjacent shape), not a premium
  boutique jerky treat.

## Dog biscuit design (locked)

- **Shape: subtle/plausible-deniability.** Reads as a normal biscuit at a
  glance; the joke lands on a second look, not the first — not sold as an
  explicit novelty item on its face.
- **Stamp: debossed, not printed.** Trollface grin pressed into the dough
  like a cookie stamp (same technique as the classic Milk-Bone logo
  press) — same tan/brown color as the rest of the biscuit, visible only
  through the shadow/relief of the press, no separate ink or icing color.
  One grin centered on the shaft.
- **Color/texture:** warm golden-tan baked biscuit color (peanut butter
  base), matte hard-baked crunchy surface, small natural flour-dust
  specks/cracks like a real oven-baked biscuit — not glossy, not
  cartoonish.

## v1 critique — shape didn't read

v1's shape description ("two rounded bulbous ends joined by a tapered
shaft") is structurally just a description of an ordinary dog bone — two
*matching* ends. Every v1 render came back as a plain symmetric bone
biscuit with no phallic read at all. The symmetry is the problem: a bone
silhouette is inherently two identical ends, while a phallic silhouette
needs asymmetry — one rounded bulbous head on one end, a flatter/narrower
base on the other, plus a slight shaft curve. v2 below rewrites the shape
spec to call out that asymmetry explicitly instead of relying on "bone
shape" to imply it.

## Current prompt set (v2 — asymmetric shape, debossed grin stamp)

**File 1 — Hero grid (2x2 composite: side view, top-down, 3/4 angle, stack of several):**
```
Studio product photography of a hard-baked dog biscuit called "Troll Bones," peanut-butter flavor. Shape is deliberately asymmetric, not a standard two-ended dog bone: one end is a single smooth rounded bulbous head, the shaft tapers and curves very slightly along its length, and the opposite end is flatter and wider than the head, without a matching knob — the overall silhouette reads at a glance as an ordinary novelty dog treat, but on a closer look resembles a phallic shape. Warm golden-tan baked color, matte hard-baked crunchy surface with small natural flour-dust specks and fine cracks like a real oven-baked biscuit — not glossy, not cartoonish. A classic trollface grin is debossed (pressed into the dough, same color as the biscuit, visible only via shadow/relief, no printed ink) centered on the shaft. Composite four shots into a clean 2x2 grid on a seamless light gray background, soft even studio lighting, no props: (1) straight-on side view of a single biscuit, (2) top-down view of a single biscuit, (3) 3/4 angle view of a single biscuit, (4) a small loose pile of several biscuits scattered naturally. Consistent shape, color, and stamp placement across all four panels.
```

**File 2 — Macro stamp detail:**
```
Close-up macro photograph of a single hard-baked peanut-butter dog biscuit, shot from directly above, focused tightly on the debossed trollface grin stamped into the center of the shaft. Warm directional lighting raking across the surface to emphasize the pressed relief texture of the stamp against the matte tan biscuit surface, natural flour-dust specks and fine surface cracks visible in sharp detail. Shallow depth of field, background softly out of focus. Same photographic style as a real bakery/treat product detail shot, not a flat render.
```

**File 3 — In use:**
```
Photograph of a dog's paw and snout reaching for a "Troll Bones" peanut-butter dog biscuit resting on a wood floor or dog bed, warm natural indoor light, shallow depth of field with the biscuit in sharp focus and the dog softly blurred in the background. Candid, editorial pet-product photography style, biscuit shape and debossed trollface stamp clearly visible.
```

## Open items

- **Flavor: peanut butter** (locked) — plain PB only, no xylitol (toxic
  to dogs). Gives the treat a warm tan/brown color matching the "small
  long brown treat" look.
- Cat treats as SKU #2: smaller scale, different shape logic since a
  dick-shaped treat reads differently at cat-treat size — probably just
  a small round trollface-stamped crunchy treat instead, keep the gag
  specific to the dog SKU.
- **Packaging reference: Retriever Peanut Butter Dog Biscuits (Tractor
  Supply house brand)** — simple large bulk bag (4 lb scale), plain
  budget house-brand look rather than boutique/premium packaging. Adapt
  layout to trollface mascot + umadbro branding but keep the cheap
  bulk-bag energy (not a fancy resealable pouch).
- Generate v2 renders from the prompt set above and critique — check the
  asymmetric shape actually reads as the joke this time (v1 came back as
  a plain symmetric bone, see critique above), and that the debossed
  stamp is legible without a contrast color.
- Pitch/listing copy once renders are confirmed.

## Note to self

Keep this file updated after every pets-design exchange in
conversation, same as shoes.md — don't wait to be asked to write it up.
