# Boot key art: two looks, ultra quality, motion

The boot screen's picture (tools/troll-ops-loading-art.mjs, troll-ops.html
#to-loading) gets a normal look and a Halloween look, a pumpkin button
swapping them (shipped 4e2f48c3, with baseline art). This is the design
pass for the art itself. User, 2026-10-31: "the halloween version isnt
spooky enough", "ultra high quality ... regardless if users have graphics
low medium or high", "animate some stuff in the image".

Everything is rendered from the game (no outside images), and every head
is checked solid at full size (the heads-never-see-through rule).

## Normal: the island in space

The island's own look (trollface-island.js: a black-blue space sky with
stars, a hard sun, dark fog at the far edge). The squad as now, all five
facing us on the floating slab. No pumpkins anywhere; the slab is grass
and violet crags. Grade: a light touch (contrast 1.06, cool blue in the
shadows, warm highlights) so it reads crisp, not graded.

Motion: the stars twinkle; the C-130 crosses the sky slowly (its own
sprite, rendered from the game with a clear background, ~90 s per pass);
the whole picture drifts 3% over the time the screen is up.

## Halloween: hollow night

- Sky: deep violet-indigo. A big, low harvest moon (size 24 -> 40) with a
  wide amber halo and a thin veil of cloud across its lower third; the
  stars thin out round it.
- Fog: the island's fog thicker and violet (density x2) so the far city
  dissolves into murk; two low ground-fog banks drift across the slab
  (CSS, blurred, opposite ways).
- Light: the moon is the key light (cool blue-white, low, from the moon's
  side); the fill crushed to purple; the city's windows warmer orange. The
  jack-o'-lanterns' point lights x2.5, so legs and chins catch orange from
  below.
- Squad: the two outer stick operators wear the Pumpkin Head
  (pumpkin-head.js buildPumpkinHead "carved": a solid carved trollface lit
  from inside). The middle three stay: trollface, the sheriff #1272,
  trollface.
- Dressing: five jack-o'-lanterns on the slab (three now), bigger; the
  Royale plane stays as a black silhouette against the moon.
- Grade: contrast 1.2, saturation 1.08, shadows pulled to #180838 (0.4),
  highlights to #ff9a3c (0.22); a vignette on the boot screen (CSS).

Motion, on top of normal's: the moon's halo breathes (6 s); each
jack-o'-lantern's glow flickers (its own random 0.1-0.3 s rhythm); the fog
banks drift; a line of bats crosses the moon every ~20 s (CSS silhouettes,
flapping).

## Ultra quality, whatever the player's setting

The art is a fixed picture: every player sees the same file, so the
render is forced to its best regardless of the Graphics option:
- shadow map 4096, PCFSoft; GTAO on at 32 samples; bloom on; sky clouds
  at max quality; anisotropy 16.
- captured at the working supersample (wide 3840x2160; tall 1728x3072,
  the one tall size the GPU returns), then lanczos down to bigger finals:
  wide 2560x1440, tall 1440x2560 (an iPhone 13 Pro is 1170x2532; today's
  1080-wide tall file is upscaled on it), webp quality 92. About 350-450
  KB a file; only the pair in use loads.

## How the motion works

One webp per look and orientation stays the picture. The tool also writes
`ui/boot/key-art-anchors.json`: for each look and frame, the moon's
centre and radius, each jack-o'-lantern's centre, and the plane's path,
as a share of the picture's width and height. boot-screen.js reads it
and lays light layers over the art: a stars canvas, glow discs at the
anchors (mix-blend screen), the fog bands, the plane sprite, the bats.
Anchors are mapped through the same object-fit: cover maths the picture
uses, so a glow stays on its pumpkin at any screen shape. Nothing costs a
network request beyond the plane sprite (a few KB). All of it pauses under
prefers-reduced-motion and Animations Off, and stops once the screen
leaves.

## Picks

1. Pumpkin Heads on the two outer operators (Halloween): yes.
2. Bats across the moon and drifting ground fog: both. No ghosts (the fog
   and bats carry it; ghosts read cute, not spooky, at this size).
3. Normal keeps the island-in-space night, the game's own look; a daytime
   island would be invented, the island is never in daylight in the game.
