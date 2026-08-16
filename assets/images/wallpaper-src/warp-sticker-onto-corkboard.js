const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const repo = 'C:\\Users\\mayur\\OneDrive\\Documents\\GitHub\\mayurski-art.github.io';
const stallBase = path.join(repo, 'assets', 'images', 'wallpaper-src', 'obj-sticker.png');
const stickerFile = path.join(repo, 'assets', 'images', 'wallpaper-src', 'sticker-sidelined.png');

const TL = { x: 462, y: 448 };
const TR = { x: 950, y: 497 };
const BL = { x: 445, y: 648 };
const U = { x: TR.x - TL.x, y: TR.y - TL.y };
const V = { x: BL.x - TL.x, y: BL.y - TL.y };
const Ulen = Math.hypot(U.x, U.y), Vlen = Math.hypot(V.x, V.y);
const uhat = { x: U.x / Ulen, y: U.y / Ulen };
const vhat = { x: V.x / Vlen, y: V.y / Vlen };

// Sticker's own inner-card rect (excludes the drop-shadow margin baked
// into sticker-sidelined.png — see make-sticker.js: card sits at 40,40,
// sized 1871x1747 inside the 1951x1827 canvas).
const S_TL = { x: 40, y: 40 };
const Sw = 1871, Sh = 1747;
const S_center = { x: S_TL.x + Sw / 2, y: S_TL.y + Sh / 2 };

const WIDTH_DEST = 200;                 // board-plane width of the sticker
const HEIGHT_DEST = WIDTH_DEST * (Sh / Sw);
const FRAC_U = 0.30, FRAC_V = 0.38;     // anchor point on the board, as a
                                         // fraction of the U/V edge vectors

(async () => {
  const stallMeta = await sharp(stallBase).metadata();
  const stickerMeta = await sharp(stickerFile).metadata();

  const Udest = { x: uhat.x * WIDTH_DEST, y: uhat.y * WIDTH_DEST };
  const Vdest = { x: vhat.x * HEIGHT_DEST, y: vhat.y * HEIGHT_DEST };
  const Mxx = Udest.x / Sw, Myx = Udest.y / Sw;
  const Mxy = Vdest.x / Sh, Myy = Vdest.y / Sh;

  const Pc = {
    x: TL.x + FRAC_U * U.x + FRAC_V * V.x,
    y: TL.y + FRAC_U * U.y + FRAC_V * V.y,
  };

  const stickerB64 = fs.readFileSync(stickerFile).toString('base64');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${stallMeta.width}" height="${stallMeta.height}">
    <g transform="translate(${Pc.x},${Pc.y}) matrix(${Mxx},${Myx},${Mxy},${Myy},0,0) translate(${-S_center.x},${-S_center.y})">
      <image href="data:image/png;base64,${stickerB64}" x="0" y="0" width="${stickerMeta.width}" height="${stickerMeta.height}"/>
    </g>
  </svg>`;

  const warped = await sharp(Buffer.from(svg)).png().toBuffer();

  await sharp(stallBase)
    .composite([{ input: warped, left: 0, top: 0 }])
    .png()
    .toFile('obj-stickers-warped2.png');

  console.log({ Pc, WIDTH_DEST, HEIGHT_DEST });
})();
