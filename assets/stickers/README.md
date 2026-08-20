# Printable sticker masters

High-resolution source images for the free printable gallery. Each file here is
both the **print master** (embedded into the generated PDFs) and the **card
preview** (scaled down by CSS). One file per template.

## Files (paths come from `assets/data/stickers.json`)

| File                          | Reference                            | Resolution  |
| ----------------------------- | ------------------------------------ | ----------- |
| `sidelined-bw.png`            | black-and-white "SIDELINED?" troll   | 1170×1477   |
| `flying-troll-qr.jpg`         | flying buff-troll wrapped in a QR    | 1155×1155   |
| `u-mad-bro.jpg`               | "U MAD BRO?" $TROLL poster           | 720×900     |
| `cupped-hands-qr.jpg`         | cupped-hands troll with the green QR | 1280×1280   |

The manifest's `image` field is the source of truth for each filename — JPG and
PNG are both fine. `u-mad-bro.jpg` (720×900) is the lowest-res master; re-export
it larger if you want crisp 4″ prints or a reliably scannable QR at small sizes.

## Rules

- **Resolution:** keep the long edge >= 1200px. At 300 DPI that covers a 4 in
  print; QR-bearing art should be as large as you can export so codes stay
  scannable.
- **Format:** PNG preferred (transparent edges print cleaner for die-cuts).
  JPGs work too — just update the `image` path in the manifest to match.
- **Adding a template:** drop a PNG here, append an entry to
  `assets/data/stickers.json`. No code changes needed.
