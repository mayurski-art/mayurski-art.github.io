# Ragebait (Trollnite expression)

- `source.png`: the user's drawing, sent in chat 2026-11-01 ("Need a 3D for this one. Call it ragebait"). 1283 x 1226, black lines on white.
- Cut out with a flood fill of the white from the edges (the scratch tool `cut-face.mjs`, this session), trimmed to the head:
  `assets/games/troll-ops/ui/trollface-ragebait.png` (the expression's art and thumb), and the same fitted whole on the head board's 512 x 480:
  `assets/games/troll-ops/traits/face-ragebait-head.png` (the Blender head build reads it).
- 3D head: `models/build_blocky_head.blender.py -- variant ragebait` -> `models/blocky/head-ragebait.glb`.
- The user's correction: the long shape hanging over the teeth is the NOSE, not a tongue (the feature map has the nose's bridge, drop and tip).
